import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { calcRank, calcTenureYears, unlockedBenefits, RANK_BENEFITS, formatMemberNumber } from "../lib/rank";
import { scoreProjectsBySkills } from "../lib/recommend";
import { buildAlerts, EVENT_REMINDER_DAYS } from "../lib/alerts";
import { publicUser } from "../lib/publicUser";

export const mypageRouter = Router();


mypageRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: {
      engagements: { include: { project: true }, orderBy: { startDate: "desc" } },
      skillSheet: true,
      clubMemberships: { include: { club: true } },
    },
  });
  if (!user) return res.status(404).json({ error: "ユーザーが見つかりません" });

  const rank = calcRank(user.joinedAt);
  const tenureYears = calcTenureYears(user.joinedAt);
  const currentEngagement = user.engagements.find((e) => e.status === "稼働中") ?? null;

  const alerts = await collectAlerts(req.userId!, user, currentEngagement);

  // 申込済みで、これから開催されるもの（参加URLつき）
  const upcoming = await prisma.eventApplication.findMany({
    where: { userId: user.id, event: { date: { gte: new Date(Date.now() - 3 * 3600_000) } } },
    include: { event: { include: { club: { select: { name: true, slug: true } } } } },
    orderBy: { event: { date: "asc" } },
    take: 4,
  });

  res.json({
    user: {
      ...publicUser(user),
      joinedAt: user.joinedAt,
      invoiceRegistrationNumber: user.invoiceRegistrationNumber,
      memberNumber: formatMemberNumber(user.id),
    },
    clubs: user.clubMemberships.map((m) => ({ slug: m.club.slug, name: m.club.name, color: m.club.color, photo: m.club.photo })),
    upcomingEvents: upcoming.map((a) => ({
      id: a.event.id,
      title: a.event.title,
      type: a.event.type,
      date: a.event.date,
      location: a.event.location,
      isOnline: a.event.isOnline,
      joinUrl: a.event.joinUrl,
      club: a.event.club,
    })),
    rank: {
      current: rank,
      tenureYears: Math.round(tenureYears * 10) / 10,
      unlockedBenefits: unlockedBenefits(rank),
      allRanks: RANK_BENEFITS,
    },
    currentEngagement,
    hasSkillSheet: !!user.skillSheet,
    engagementHistory: user.engagements,
    alerts,
  });
});

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  workStyle: z.enum(["freelance", "ses_employee", "considering"]).optional(),
  invoiceRegistrationNumber: z.string().min(1).max(20).nullable().optional(),
});

// プロフィール更新（氏名・インボイス登録番号の自己設定）
mypageRouter.patch("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "入力内容を確認してください", details: parsed.error.flatten() });
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: parsed.data,
  });

  res.json({ user: { ...publicUser(user), invoiceRegistrationNumber: user.invoiceRegistrationNumber } });
});

async function collectAlerts(
  userId: string,
  user: { skillSheet: { skills: string } | null; workStyle: string; lastCheckupDate: Date | null },
  currentEngagement: { id: string; endDate: Date | null; project: { title: string } } | null
) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const userSkillNames = user.skillSheet ? (JSON.parse(user.skillSheet.skills) as { name: string }[]).map((s) => s.name) : [];

  const [projects, unpaid, issued, unsignedContractCount, soonEvents] = await Promise.all([
    prisma.project.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.invoice.findMany({ where: { engagement: { userId }, paidAt: null }, include: { engagement: { include: { project: true } } } }),
    currentEngagement ? prisma.invoice.findFirst({ where: { engagementId: currentEngagement.id, targetMonth: ym } }) : null,
    prisma.contract.count({ where: { engagement: { userId }, status: "未締結" } }),
    prisma.event.findMany({
      where: {
        date: { gte: now, lte: new Date(now.getTime() + EVENT_REMINDER_DAYS * 86_400_000) },
        applications: { none: { userId } },
      },
      take: 1,
      orderBy: { date: "asc" },
    }),
  ]);

  return buildAlerts({
    now,
    workStyle: user.workStyle,
    hasSkillSheet: !!user.skillSheet,
    lastCheckupDate: user.lastCheckupDate,
    currentEngagement,
    recommendedProjects: scoreProjectsBySkills(projects, userSkillNames).slice(0, 3),
    unpaidInvoices: unpaid.map((i) => ({ ...i, client: i.engagement.project.client })),
    currentMonthInvoiceIssued: !!issued,
    unsignedContractCount,
    soonUnappliedEvent: soonEvents[0] ?? null,
  });
}
