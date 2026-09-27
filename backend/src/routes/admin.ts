import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireAdmin, AuthedRequest } from "../middleware/auth";

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

  const leads = users.map((u) => {
    const reasons: string[] = [];
    let score = 0;
    const current = u.engagements[0];
    const daysLeft = current?.endDate ? Math.ceil((current.endDate.getTime() - now) / DAY) : null;

    if (daysLeft != null && daysLeft <= 60) {
      score += 40;
      reasons.push(`契約終了まで${daysLeft}日`);
    }
    if (u.workStyle === "freelance" && !current) {
      score += 35;
      reasons.push("稼働中の案件なし");
    }
    if (u.workStyle === "considering") {
      score += 30;
      reasons.push("独立を検討中");
    }
    if (u.workStyle === "ses_employee") {
      score += 10;
      reasons.push("SES会社員（将来の独立候補）");
    }
    if (u.skillSheet) {
      score += 15;
      reasons.push("スキルシート作成済み");
    }
    if (u.rateDiagnoses.length > 0) {
      score += 10;
      reasons.push("単価診断を利用");
    }
    const engagement = u.clubMemberships.length + u.eventApplications.length + (u.healthLogs.length > 0 ? 1 : 0);
    if (engagement > 0) {
      score += Math.min(15, engagement * 5);
      reasons.push(`コミュニティ参加 ${u.clubMemberships.length}部・${u.eventApplications.length}イベント`);
    }

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
      score: Math.min(100, score),
      reasons,
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
