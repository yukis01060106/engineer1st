// 税金の取り分け目安: 入金のたびに「いくら残しておけば、来年の税金・保険料で困らないか」を概算する
// 注: 概算モデル。自治体・扶養・控除の状況で大きく変わるため、断定はしない
import { simulateReward } from "./rewardSimulator";

export type ConsumptionTaxMode = "exempt" | "special" | "simplified";

// インボイス登録した個人事業者の負担軽減措置
// 2割特例: 2026年分まで／3割特例: 2027年分・2028年分（令和8年度税制改正で個人事業者に限り延長）
export function consumptionTaxRatio(year: number, mode: ConsumptionTaxMode): { ratio: number; label: string } {
  if (mode === "exempt") return { ratio: 0, label: "免税事業者（インボイス未登録）" };
  if (mode === "special") {
    if (year <= 2026) return { ratio: 0.2, label: "2割特例（売上にかかる消費税の20%を納税）" };
    if (year <= 2028) return { ratio: 0.3, label: "3割特例（売上にかかる消費税の30%を納税）" };
  }
  // 簡易課税・第5種事業（サービス業）: みなし仕入率50%
  return { ratio: 0.5, label: "簡易課税（サービス業・みなし仕入率50%）" };
}

export interface TaxReserveInput {
  monthlyRate: number;
  workingMonths: number;
  expenseRatio: number;
  isBlueTaxReturn: boolean;
  invoiceRegistered: boolean;
  year: number;
}

export interface TaxReserveResult {
  annualRevenue: number;
  items: { key: string; label: string; annual: number; when: string }[];
  totalAnnual: number;
  reserveRate: number; // 入金（税抜）に対して取り分ける割合
  monthlyReserve: number;
  consumptionTaxLabel: string;
}

export function calcTaxReserve(input: TaxReserveInput): TaxReserveResult {
  const sim = simulateReward({
    monthlyRate: input.monthlyRate,
    workingMonths: input.workingMonths,
    expenseRatio: input.expenseRatio,
    isBlueTaxReturn: input.isBlueTaxReturn,
  });
  const ct = consumptionTaxRatio(input.year, input.invoiceRegistered ? "special" : "exempt");
  const consumptionTax = Math.round(sim.annualRevenue * 0.1 * ct.ratio);

  const items = [
    { key: "income", label: "所得税", annual: sim.incomeTax, when: "3月15日（確定申告）※前年の納税額が15万円以上なら7月・11月に予定納税" },
    { key: "resident", label: "住民税", annual: sim.residentTax, when: "6月・8月・10月・翌1月（6月に通知が届く）" },
    { key: "business", label: "個人事業税", annual: sim.businessTax, when: "8月・11月" },
    { key: "nhi", label: "国民健康保険", annual: sim.nationalHealthInsurance, when: "6月〜翌3月（自治体により異なる）" },
    { key: "pension", label: "国民年金", annual: sim.nationalPension, when: "毎月（前納で割引あり）" },
    { key: "consumption", label: "消費税", annual: consumptionTax, when: "3月31日" },
  ];
  const totalAnnual = items.reduce((s, i) => s + i.annual, 0);
  const reserveRate = sim.annualRevenue > 0 ? totalAnnual / sim.annualRevenue : 0;

  return {
    annualRevenue: sim.annualRevenue,
    items,
    totalAnnual,
    reserveRate: Math.round(reserveRate * 1000) / 1000,
    monthlyReserve: Math.round(totalAnnual / 12),
    consumptionTaxLabel: ct.label,
  };
}
