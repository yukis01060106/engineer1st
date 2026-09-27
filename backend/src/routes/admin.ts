import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireAdmin, AuthedRequest } from "../middleware/auth";
import { z } from "zod";
import { scoreLead } from "../lib/leadScore";
import { chatThread } from "./chat";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

const DAY = 86_400_000;

// 見込み客の一覧: 「今、案件の提案を喜んでもらえそうか」をスコア化して並べる
adminRouter.get("/leads", async (_req: AuthedRequest, res) => {
  const now = Date.now();
  const users = await prisma.user.findMany({
    where: { role: "member" },
    include: {
      engagements: { where: { status: "稼働中" }, include: { project: true } },
      clubMemberships: { include: { club: true } },
      eventApplications: true,
      skillSheet: { select: { id: true, desiredRate: true } },
      rateDiagnoses: { select: { id: true } },
      healthLogs: { where: { date: { gte: new Date(now - 14 * DAY).toISOString().slice(0, 10) } }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const referralCounts = new Map<string, number>();
  for (const u of users) if (u.referredById) referralCounts.set(u.referredById, (referralCounts.get(u.referredById) ?? 0) + 1);

  const leads = users.map((u) => {
    const current = u.engagements[0];
    const daysLeft = current?.endDate ? Math.ceil((current.endDate.getTime() - now) / DAY) : null;
    const { score, reasons } = scoreLead({
      workStyle: u.workStyle,
      currentEngagementDaysLeft: daysLeft,
      hasCurrentEngagement: !!current,
      hasSkillSheet: !!u.skillSheet,
      rateDiagnosisCount: u.rateDiagnoses.length,
      clubCount: u.clubMemberships.length,
      eventCount: u.eventApplications.length,
      loggedHealthRecently: u.healthLogs.length > 0,
      referred: !!u.referredById,
      referralCount: referralCounts.get(u.id) ?? 0,
    });

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      workStyle: u.workStyle,
      signupSource: u.signupSource,
      createdAt: u.createdAt,
      clubs: u.clubMemberships.map((m) => m.club.name),
      currentProject: current ? { title: current.project.title, monthlyRate: current.monthlyRate, daysLeft } : null,
      desiredRate: u.skillSheet?.desiredRate ?? null,
      score,
      reasons,
      referralCount: referralCounts.get(u.id) ?? 0,
    };
  });
  leads.sort((a, b) => b.score - a.score);

  const since30 = new Date(now - 30 * DAY);
  const bySource = new Map<string, number>();
  for (const u of users) {
    const key = u.signupSource ?? "direct";
    bySource.set(key, (bySource.get(key) ?? 0) + 1);
  }

  const [clubs, events] = await Promise.all([
    prisma.club.findMany({ include: { _count: { select: { memberships: true } } }, orderBy: { sortOrder: "asc" } }),
    prisma.event.findMany({
      where: { date: { gte: new Date(now - DAY) } },
      include: { _count: { select: { applications: true } }, club: { select: { name: true } } },
      orderBy: { date: "asc" },
    }),
  ]);

  res.json({
    summary: {
      totalMembers: users.length,
      newLast30Days: users.filter((u) => u.createdAt >= since30).length,
      byWorkStyle: {
        freelance: users.filter((u) => u.workStyle === "freelance").length,
        ses_employee: users.filter((u) => u.workStyle === "ses_employee").length,
        considering: users.filter((u) => u.workStyle === "considering").length,
      },
      hotLeads: leads.filter((l) => l.score >= 50).length,
      bySource: Object.fromEntries(bySource),
    },
    leads,
    clubs: clubs.map((c) => ({ id: c.id, name: c.name, slug: c.slug, members: c._count.memberships })),
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      date: e.date,
      capacity: e.capacity,
      applications: e._count.applications,
      club: e.club?.name ?? null,
      hasJoinUrl: !!e.joinUrl,
    })),
  });
});

// 相談・問い合わせ: メンター相談と、担当者の返信を待っているチャット
adminRouter.get("/inbox", async (_req: AuthedRequest, res) => {
  const [mentor, messages] = await Promise.all([
    prisma.mentorRequest.findMany({ include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.chatMessage.findMany({ include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
  ]);

  const threads = new Map<string, { userId: string; name: string; email: string; lastText: string; lastAt: Date; waiting: boolean; count: number }>();
  for (const m of messages) {
    const t = threads.get(m.userId) ?? { userId: m.userId, name: m.user.name, email: m.user.email, lastText: "", lastAt: m.createdAt, waiting: false, count: 0 };
    if (m.from === "user") {
      t.lastText = m.text;
      t.waiting = true;
      t.count += 1;
    } else if (!m.auto) {
      t.waiting = false; // 担当者が返信済み
    }
    t.lastAt = m.createdAt;
    threads.set(m.userId, t);
  }

  res.json({
    mentor: mentor.map((r) => ({ id: r.id, topic: r.topic, message: r.message, status: r.status, createdAt: r.createdAt, user: r.user })),
    chats: [...threads.values()].sort((a, b) => Number(b.waiting) - Number(a.waiting) || b.lastAt.getTime() - a.lastAt.getTime()),
  });
});

adminRouter.patch("/mentor/:id", async (req: AuthedRequest, res) => {
  const parsed = z.object({ status: z.enum(["受付中", "対応中", "完了"]) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "状態を選んでください" });
  const request = await prisma.mentorRequest.update({ where: { id: req.params.id }, data: { status: parsed.data.status } }).catch(() => null);
  if (!request) return res.status(404).json({ error: "相談が見つかりません" });
  res.json({ request });
});

adminRouter.get("/chat/:userId", async (req: AuthedRequest, res) => {
  res.json({ messages: await chatThread(req.params.userId) });
});

adminRouter.post("/chat/:userId", async (req: AuthedRequest, res) => {
  const parsed = z.object({ text: z.string().trim().min(1).max(2000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "メッセージを入力してください" });
  const member = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!member) return res.status(404).json({ error: "会員が見つかりません" });
  await prisma.chatMessage.create({ data: { userId: member.id, from: "staff", text: parsed.data.text } });
  res.status(201).json({ messages: await chatThread(member.id) });
});
