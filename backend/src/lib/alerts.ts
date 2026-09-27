// マイページの「やること」を組み立てる（DBに依存しない純粋関数。フロントのデモ版でも使う）
import { invoiceState } from "./invoice";

export const ENGAGEMENT_ENDING_SOON_DAYS = 45;
export const EVENT_REMINDER_DAYS = 14;
export const CHECKUP_INTERVAL_DAYS = 365;

export interface Alert {
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

export interface AlertInput {
  now: Date;
  workStyle: string;
  hasSkillSheet: boolean;
  lastCheckupDate: Date | null;
  currentEngagement: { id: string; endDate: Date | null; project: { title: string } } | null;
  // 契約終了が近いときに出すおすすめ案件（呼び出し側でスコアリング済み）
  recommendedProjects: unknown[];
  unpaidInvoices: { targetMonth: string; paidAt: Date | null; dueDate: Date | null; client: string }[];
  currentMonthInvoiceIssued: boolean;
  unsignedContractCount: number;
  // 14日以内に開催され、まだ申し込んでいないイベント
  soonUnappliedEvent: { id: string; title: string } | null;
}

export function buildAlerts(input: AlertInput): Alert[] {
  const { now, currentEngagement } = input;
  const alerts: Alert[] = [];

  // 稼働終了が近づいている → 案件を先回りでレコメンド
  if (currentEngagement?.endDate) {
    const daysLeft = Math.ceil((currentEngagement.endDate.getTime() - now.getTime()) / 86_400_000);
    if (daysLeft >= 0 && daysLeft <= ENGAGEMENT_ENDING_SOON_DAYS) {
      alerts.push({
        type: "engagement_ending",
        tone: "urgent",
        message: `「${currentEngagement.project.title}」の稼働終了まで残り${daysLeft}日です。次の案件を早めにご案内します。`,
        actionLabel: "案件一覧を見る",
        actionPath: "/projects",
        recommendedProjects: input.recommendedProjects,
      });
    }
  }

  // 支払期日を過ぎた請求（フリーランスの取引トラブル1位は支払遅延）
  const overdue = input.unpaidInvoices.filter((i) => invoiceState(i, now) === "overdue");
  if (overdue.length > 0) {
    alerts.push({
      type: "payment_overdue",
      tone: "urgent",
      message: `支払期日を過ぎた請求が${overdue.length}件あります（${overdue[0].client}・${overdue[0].targetMonth}分）。入金を確認しましょう。`,
      actionLabel: "入金を確認する",
      actionPath: "/money",
    });
  }

  // 今月分の請求書がまだ（月末の5日前から）
  if (currentEngagement && input.workStyle === "freelance" && !input.currentMonthInvoiceIssued) {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (now.getDate() >= lastDay - 5) {
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
  if (input.workStyle === "freelance" && (now.getMonth() === 4 || now.getMonth() === 5)) {
    alerts.push({
      type: "tax_season",
      tone: "info",
      message: "6月に住民税と国民健康保険の通知が届きます。取り分けておいた分で足りるか確認しましょう。",
      actionLabel: "取り分けを確認",
      actionPath: "/money#tax",
    });
  }

  // 健康診断（フリーランスは会社の健診がない）
  const daysSinceCheckup = input.lastCheckupDate
    ? Math.floor((now.getTime() - input.lastCheckupDate.getTime()) / 86_400_000)
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

  if (input.unsignedContractCount > 0) {
    alerts.push({
      type: "contract_unsigned",
      tone: "normal",
      message: `未締結の契約書が${input.unsignedContractCount}件あります。`,
      actionLabel: "確認する",
      actionPath: "/contracts",
    });
  }

  if (input.soonUnappliedEvent) {
    alerts.push({
      type: "event_upcoming",
      tone: "info",
      message: `間もなく開催「${input.soonUnappliedEvent.title}」。まだ申込されていません。`,
      actionLabel: "詳細を見る",
      actionPath: `/events/${input.soonUnappliedEvent.id}`,
    });
  }

  if (!input.hasSkillSheet) {
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
