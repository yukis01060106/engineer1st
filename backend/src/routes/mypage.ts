import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { calcRank, calcTenureYears, unlockedBenefits, RANK_BENEFITS, formatMemberNumber } from "../lib/rank";
import { scoreProjectsBySkills } from "../lib/recommend";
import { buildAlerts, EVENT_REMINDER_DAYS } from "../lib/alerts";
import { buildOnboarding } from "../lib/onboarding";
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

  const [eventCount, healthLogCount, wealthPlan] = await Promise.all([
    prisma.eventApplication.count({ where: { userId: user.id } }),
    prisma.healthLog.count({ where: { userId: user.id } }),
    prisma.wealthPlan.findUnique({ where: { userId: user.id } }),
  ]);
  const onboarding = buildOnboarding({
    workStyle: user.workStyle,
    clubCount: user.clubMemberships.length,
    eventCount,
    healthLogCount,
    hasWealthPlan: !!wealthPlan,
    hasSkillSheet: !!user.skillSheet,
    engagementCount: user.engagements.length,
    hasInvoiceNumber: !!user.invoiceRegistrationNumber,
  });
  const referralCount = await prisma.user.count({ where: { referredById: user.id } });

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
      billingProfile: JSON.parse(user.billingProfile),
      memberNumber: formatMemberNumber(user.id),
    },
    onboarding,
    referralCount,
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

const bankSchema = z.object({
  bankName: z.string().trim().max(40),
  branchName: z.string().trim().max(40),
  accountType: z.enum(["普通", "当座"]),
  accountNumber: z.string().regex(/^\d{7}$/, "口座番号は7桁の数字で入力してください"),
  accountHolder: z.string().trim().max(60),
});

const billingProfileSchema = z.object({
  businessName: z.string().trim().max(60).optional(),
  postalCode: z.string().regex(/^(\d{3}-?\d{4})?$/, "郵便番号は7桁で入力してください").optional(),
  address: z.string().trim().max(120).optional(),
  phone: z.string().regex(/^[\d-]{0,15}$/, "電話番号は数字とハイフンで入力してください").optional(),
  bank: bankSchema.nullable().optional(),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  workStyle: z.enum(["freelance", "ses_employee", "considering"]).optional(),
  invoiceRegistrationNumber: z.string().regex(/^T\d{13}$/, "登録番号は T から始まる14桁で入力してください").nullable().optional(),
  billingProfile: billingProfileSchema.optional(),
});

// プロフィール更新（氏名・インボイス登録番号の自己設定）
mypageRouter.patch("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return res.status(400).json({ error: first && !first.startsWith("Invalid") && !first.startsWith("Expected") ? first : "入力内容を確認してください", details: parsed.error.flatten() });
  }
  const { billingProfile, ...rest } = parsed.data;

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { ...rest, ...(billingProfile ? { billingProfile: JSON.stringify(billingProfile) } : {}) },
  });

  res.json({
    user: { ...publicUser(user), invoiceRegistrationNumber: user.invoiceRegistrationNumber, billingProfile: JSON.parse(user.billingProfile) },
  });
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
    prisma.project.findMany({ where: { isListed: true }, orderBy: { createdAt: "desc" } }),
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

  const lastChat = await prisma.chatMessage.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
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
    staffReplied: lastChat?.from === "staff" && !lastChat.auto,
  });
}
