// AI FPに渡す「本人のお金の実データ」をまとめる。家計簿アプリにはない、契約単価・更新時期・入金状況が強み
import { prisma } from "./prisma";
import { simulateReward } from "./rewardSimulator";
import { calcTaxReserve } from "./taxReserve";
import { simulateWealth, marginalRate } from "./wealth";
import { invoiceState } from "./invoice";

export async function buildFinancialSnapshot(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      engagements: { include: { project: true }, orderBy: { startDate: "desc" } },
      wealthPlan: true,
    },
  });
  if (!user) throw new Error("user not found");

  const current = user.engagements.find((e) => e.status === "稼働中") ?? null;
  const monthlyRate = current?.monthlyRate ?? 0;
  const reward = monthlyRate ? simulateReward({ monthlyRate, workingMonths: 12, expenseRatio: 0.2, isBlueTaxReturn: true }) : null;
  const reserve = monthlyRate
    ? calcTaxReserve({
        monthlyRate,
        workingMonths: 12,
        expenseRatio: 0.2,
        isBlueTaxReturn: true,
        invoiceRegistered: !!user.invoiceRegistrationNumber,
        year: new Date().getFullYear(),
      })
    : null;

  const invoices = await prisma.invoice.findMany({ where: { engagement: { userId } } });
  const overdue = invoices.filter((i) => invoiceState(i) === "overdue");
  const unpaid = invoices.filter((i) => invoiceState(i) === "unpaid");

  const plan = user.wealthPlan;
  const age = user.birthYear ? new Date().getFullYear() - user.birthYear : 32;
  const wealth = plan
    ? simulateWealth({
        age,
        retireAge: plan.retireAge,
        monthlyLivingCost: plan.monthlyLivingCost,
        cashSavings: plan.cashSavings,
        investedAssets: plan.investedAssets,
        kyosaiMonthly: plan.kyosaiMonthly,
        idecoMonthly: plan.idecoMonthly,
        nisaMonthly: plan.nisaMonthly,
        expectedReturn: plan.expectedReturn,
        monthlyNetIncome: reward?.netIncomeMonthly ?? 0,
        marginalTaxRate: marginalRate(reward?.taxableIncome ?? 0),
      })
    : null;

  const daysLeft = current?.endDate ? Math.ceil((current.endDate.getTime() - Date.now()) / 86_400_000) : null;

  return {
    name: user.name,
    workStyle: user.workStyle,
    age,
    invoiceRegistered: !!user.invoiceRegistrationNumber,
    current: current
      ? { title: current.project.title, monthlyRate, endDate: current.endDate, daysLeft, paymentTermDays: current.paymentTermDays }
      : null,
    reward,
    reserve,
    invoices: {
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((s, i) => s + i.totalAmount, 0),
      unpaidAmount: unpaid.reduce((s, i) => s + i.totalAmount, 0),
    },
    plan,
    wealth,
  };
}

export type FinancialSnapshot = Awaited<ReturnType<typeof buildFinancialSnapshot>>;

const man = (n: number) => `${Math.round(n / 10_000).toLocaleString()}万円`;
const yen = (n: number) => `${Math.round(n).toLocaleString()}円`;

// Claudeに渡す、人が読める形のデータ要約
export function snapshotToText(s: FinancialSnapshot): string {
  const lines = [
    `氏名: ${s.name}（${s.age}歳、働き方: ${s.workStyle === "freelance" ? "フリーランス" : s.workStyle === "ses_employee" ? "SES会社員" : "独立検討中"}）`,
    `インボイス登録: ${s.invoiceRegistered ? "あり" : "なし"}`,
  ];
  if (s.current) {
    lines.push(
      `稼働中の案件: ${s.current.title}／月単価 ${yen(s.current.monthlyRate)}／支払サイト ${s.current.paymentTermDays}日` +
        (s.current.daysLeft != null ? `／契約終了まで残り${s.current.daysLeft}日` : "")
    );
  } else {
    lines.push("稼働中の案件: なし");
  }
  if (s.reward) {
    lines.push(`年間売上見込み ${man(s.reward.annualRevenue)}／手取り月額の目安 ${yen(s.reward.netIncomeMonthly)}／課税所得 ${man(s.reward.taxableIncome)}`);
  }
  if (s.reserve) {
    lines.push(
      `税金・保険料の年額目安 ${man(s.reserve.totalAnnual)}（入金の約${Math.round(s.reserve.reserveRate * 100)}%を取り分け推奨）: ` +
        s.reserve.items.map((i) => `${i.label}${man(i.annual)}`).join("、") +
        `／消費税: ${s.reserve.consumptionTaxLabel}`
    );
  }
  lines.push(`未入金 ${yen(s.invoices.unpaidAmount)}、支払期日を過ぎた請求 ${s.invoices.overdueCount}件（${yen(s.invoices.overdueAmount)}）`);
  if (s.plan && s.wealth) {
    lines.push(
      `毎月の生活費 ${yen(s.plan.monthlyLivingCost)}／預金 ${man(s.plan.cashSavings)}／投資資産 ${man(s.plan.investedAssets)}`,
      `積立: 小規模企業共済 ${yen(s.plan.kyosaiMonthly)}、iDeCo ${yen(s.plan.idecoMonthly)}、NISA ${yen(s.plan.nisaMonthly)}（月）／想定利回り ${s.plan.expectedReturn * 100}%／${s.plan.retireAge}歳時点の試算 ${man(s.wealth.retireTotal)}`,
      `生活費を引いた月の余力 ${yen(s.wealth.monthlySurplus)}／共済・iDeCoによる節税額の目安 年${yen(s.wealth.annualTaxSaving)}`
    );
  } else {
    lines.push("資産形成プラン: 未入力");
  }
  return lines.join("\n");
}
