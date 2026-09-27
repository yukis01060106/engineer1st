import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { calcRank, calcTenureYears, unlockedBenefits, RANK_BENEFITS, formatMemberNumber } from "../lib/rank";
import { scoreProjectsBySkills } from "../lib/recommend";
import { invoiceState } from "../lib/invoice";
import { publicUser } from "../lib/publicUser";

export const mypageRouter = Router();

const ENGAGEMENT_ENDING_SOON_DAYS = 45;
const EVENT_REMINDER_DAYS = 14;
const CHECKUP_INTERVAL_DAYS = 365;

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

  const alerts = await buildAlerts(req.userId!, user, currentEngagement);

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

interface Alert {
  type:
    | "engagement_ending"
    | "payment_overdue"
    | "contract_unsigned"
    | "event_upcoming"
    | "skill_sheet_missing"
    | "checkup_due"
    | "tax_season"
    | "invoice_due";
  tone: "urgent" | "normal" | "info";
  message: string;
  actionLabel: string;
  actionPath: string;
  recommendedProjects?: unknown[];
}

async function buildAlerts(
  userId: string,
  user: { skillSheet: { skills: string } | null; workStyle: string; lastCheckupDate: Date | null },
  currentEngagement: { id: string; endDate: Date | null; project: { title: string } } | null
): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const now = new Date();

  // 稼働終了が近づいている → 案件を先回りでレコメンド（カスタマージャーニー⑧の実装）
  if (currentEngagement?.endDate) {
    const daysLeft = Math.ceil(
      (currentEngagement.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysLeft >= 0 && daysLeft <= ENGAGEMENT_ENDING_SOON_DAYS) {
      const skillSheet = user.skillSheet;
      const userSkillNames = skillSheet
        ? (JSON.parse(skillSheet.skills) as { name: string }[]).map((s) => s.name)
        : [];
      const projects = await prisma.project.findMany({ orderBy: { createdAt: "desc" } });
      const recommended = scoreProjectsBySkills(projects, userSkillNames).slice(0, 3);

      alerts.push({
        type: "engagement_ending",
        tone: "urgent",
        message: `「${currentEngagement.project.title}」の稼働終了まで残り${daysLeft}日です。次の案件を早めにご案内します。`,
        actionLabel: "案件一覧を見る",
        actionPath: "/projects",
        recommendedProjects: recommended,
      });
    }
  }

  // 支払期日を過ぎた請求（フリーランスの取引トラブル1位は支払遅延）
  const invoices = await prisma.invoice.findMany({
    where: { engagement: { userId }, paidAt: null },
    include: { engagement: { include: { project: true } } },
  });
  const overdue = invoices.filter((i) => invoiceState(i) === "overdue");
  if (overdue.length > 0) {
    alerts.push({
      type: "payment_overdue",
      tone: "urgent",
      message: `支払期日を過ぎた請求が${overdue.length}件あります（${overdue[0].engagement.project.client}・${overdue[0].targetMonth}分）。入金を確認しましょう。`,
      actionLabel: "入金を確認する",
      actionPath: "/money",
    });
  }

  // 今月分の請求書がまだ（月末の5日前から）
  if (currentEngagement && user.workStyle === "freelance") {
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const issued = await prisma.invoice.findFirst({ where: { engagementId: currentEngagement.id, targetMonth: ym } });
    if (!issued && now.getDate() >= lastDay - 5) {
      alerts.push({
        type: "invoice_due",
        tone: "normal",
        message: `${now.getMonth() + 1}月分の請求書がまだです。稼働時間を入れるだけで、精算幅の計算まで自動で作れます。`,
        actionLabel: "請求書をつくる",
        actionPath: "/money",
      });
    }
  }

  // 住民税・国保の通知が届く時期（5〜6月）
  if (user.workStyle === "freelance" && (now.getMonth() === 4 || now.getMonth() === 5)) {
    alerts.push({
      type: "tax_season",
      tone: "info",
      message: "6月に住民税と国民健康保険の通知が届きます。取り分けておいたお金で足りるか確認しましょう。",
      actionLabel: "取り分けを確認",
      actionPath: "/money#tax",
    });
  }

  // 健康診断（フリーランスは会社の健診がない）
  const daysSinceCheckup = user.lastCheckupDate
    ? Math.floor((now.getTime() - user.lastCheckupDate.getTime()) / 86_400_000)
    : null;
  if (daysSinceCheckup == null || daysSinceCheckup >= CHECKUP_INTERVAL_DAYS) {
    alerts.push({
      type: "checkup_due",
      tone: "info",
      message:
        daysSinceCheckup == null
          ? "健康診断の受診日が未登録です。会社の健診がない分、年1回は自分で予約しましょう。"
          : `前回の健康診断から${Math.floor(daysSinceCheckup / 30)}か月が経ちました。`,
      actionLabel: "健康メニューへ",
      actionPath: "/health",
    });
  }

  // 未締結の契約書
  const unsignedContractCount = await prisma.contract.count({
    where: { engagement: { userId }, status: "未締結" },
  });
  if (unsignedContractCount > 0) {
    alerts.push({
      type: "contract_unsigned",
      tone: "normal",
      message: `未締結の契約書が${unsignedContractCount}件あります。`,
      actionLabel: "確認する",
      actionPath: "/contracts",
    });
  }

  // 直近のイベントで未申込のもの
  const soonEvents = await prisma.event.findMany({
    where: {
      date: { gte: now, lte: new Date(now.getTime() + EVENT_REMINDER_DAYS * 24 * 60 * 60 * 1000) },
      applications: { none: { userId } },
    },
    take: 1,
    orderBy: { date: "asc" },
  });
  if (soonEvents.length > 0) {
    alerts.push({
      type: "event_upcoming",
      tone: "info",
      message: `間もなく開催「${soonEvents[0].title}」。まだ申込されていません。`,
      actionLabel: "詳細を見る",
      actionPath: `/events/${soonEvents[0].id}`,
    });
  }

  // スキルシート未作成
  if (!user.skillSheet) {
    alerts.push({
      type: "skill_sheet_missing",
      tone: "normal",
      message: "スキルシートがまだ作成されていません。1分で自動生成できます。",
      actionLabel: "作成する",
      actionPath: "/skill-sheet",
    });
  }

  return alerts;
}
