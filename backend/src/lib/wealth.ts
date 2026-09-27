// 資産形成シミュレーション: フリーランスは退職金・厚生年金がないため、
// 「生活防衛資金 → 小規模企業共済 → iDeCo → NISA」の順で、無理のない積立額を提案する
// 注: 制度の一般的な説明と試算のみ。特定の金融商品の推奨はしない（投資助言にあたるため）

export const KYOSAI_MAX = 70_000; // 小規模企業共済の掛金上限（月）
export const IDECO_MAX_SELF_EMPLOYED = 68_000; // iDeCo 第1号被保険者の上限（月、国民年金基金と合算）
export const NISA_MAX_MONTHLY = 300_000; // つみたて投資枠 年120万円 ÷ 12
export const EMERGENCY_MONTHS = 6; // フリーランスは案件の空白期間に備えて生活費6か月分

export interface WealthInput {
  age: number;
  retireAge: number;
  monthlyLivingCost: number;
  cashSavings: number;
  investedAssets: number;
  kyosaiMonthly: number;
  idecoMonthly: number;
  nisaMonthly: number;
  expectedReturn: number; // 年率
  monthlyNetIncome: number; // 手取り月収（税・社会保険料控除後）
  marginalTaxRate: number; // 所得税＋住民税の限界税率（節税額の概算用）
}

export interface WealthStep {
  key: "emergency" | "kyosai" | "ideco" | "nisa";
  title: string;
  status: "done" | "doing" | "todo";
  current: number;
  target: number;
  why: string;
}

export interface WealthResult {
  steps: WealthStep[];
  monthlySurplus: number; // 生活費を引いた余力
  totalMonthlySaving: number;
  annualTaxSaving: number; // 共済・iDeCoの所得控除による節税額（概算）
  projection: { age: number; total: number; principal: number }[];
  retireTotal: number;
  suggestion: { kyosai: number; ideco: number; nisa: number; cashBuffer: number };
}

function futureValue(monthly: number, years: number, r: number, initial = 0) {
  const n = years * 12;
  const i = r / 12;
  const fvInitial = initial * Math.pow(1 + i, n);
  const fvMonthly = i === 0 ? monthly * n : monthly * ((Math.pow(1 + i, n) - 1) / i);
  return fvInitial + fvMonthly;
}

export function simulateWealth(input: WealthInput): WealthResult {
  const emergencyTarget = input.monthlyLivingCost * EMERGENCY_MONTHS;
  const monthlySurplus = Math.max(0, input.monthlyNetIncome - input.monthlyLivingCost);

  // 余力の配分提案: まず生活防衛資金が貯まるまで余力の半分を現金に、残りを共済→iDeCo→NISAの順に
  let pool = monthlySurplus;
  const emergencyGap = Math.max(0, emergencyTarget - input.cashSavings);
  const cashBuffer = emergencyGap > 0 ? Math.min(pool * 0.5, emergencyGap) : 0;
  pool -= cashBuffer;
  // 余力をすべて積み立てに回さず、2割は自由に使える余白として残す
  pool = pool * 0.8;
  const kyosai = Math.min(KYOSAI_MAX, Math.floor(pool * 0.4 / 1000) * 1000);
  pool -= kyosai;
  const ideco = Math.min(IDECO_MAX_SELF_EMPLOYED, Math.floor(pool * 0.5 / 1000) * 1000);
  pool -= ideco;
  const nisa = Math.min(NISA_MAX_MONTHLY, Math.floor(pool / 1000) * 1000);

  const steps: WealthStep[] = [
    {
      key: "emergency",
      title: `生活防衛資金（生活費${EMERGENCY_MONTHS}か月分）`,
      status: input.cashSavings >= emergencyTarget ? "done" : input.cashSavings > 0 ? "doing" : "todo",
      current: input.cashSavings,
      target: emergencyTarget,
      why: "案件が切れてから次が決まるまで、面談〜契約で最低3〜4週間かかります。まずは現金で備えます。",
    },
    {
      key: "kyosai",
      title: "小規模企業共済（退職金の代わり）",
      status: input.kyosaiMonthly >= KYOSAI_MAX ? "done" : input.kyosaiMonthly > 0 ? "doing" : "todo",
      current: input.kyosaiMonthly,
      target: KYOSAI_MAX,
      why: "掛金は全額所得控除。廃業時に受け取れ、低金利の貸付制度もあります。",
    },
    {
      key: "ideco",
      title: "iDeCo（自分でつくる年金）",
      status: input.idecoMonthly >= IDECO_MAX_SELF_EMPLOYED ? "done" : input.idecoMonthly > 0 ? "doing" : "todo",
      current: input.idecoMonthly,
      target: IDECO_MAX_SELF_EMPLOYED,
      why: "掛金は全額所得控除、運用益も非課税。ただし原則60歳まで引き出せません。",
    },
    {
      key: "nisa",
      title: "NISA（いつでも引き出せる投資枠）",
      status: input.nisaMonthly > 0 ? "doing" : "todo",
      current: input.nisaMonthly,
      target: NISA_MAX_MONTHLY,
      why: "運用益が非課税で、いつでも引き出せます。所得控除はありません。",
    },
  ];

  const deductible = (input.kyosaiMonthly + input.idecoMonthly) * 12;
  const annualTaxSaving = Math.round(deductible * input.marginalTaxRate);
  const totalMonthlySaving = input.kyosaiMonthly + input.idecoMonthly + input.nisaMonthly;

  const years = Math.max(0, input.retireAge - input.age);
  const projection: { age: number; total: number; principal: number }[] = [];
  for (let y = 0; y <= years; y += Math.max(1, Math.ceil(years / 12))) {
    // 共済はほぼ元本＋わずかな付加共済金のため利回り1%、iDeCo・NISAは想定利回りで試算
    const total =
      futureValue(input.kyosaiMonthly, y, 0.01) +
      futureValue(input.idecoMonthly + input.nisaMonthly, y, input.expectedReturn, input.investedAssets);
    const principal = input.investedAssets + totalMonthlySaving * 12 * y;
    projection.push({ age: input.age + y, total: Math.round(total), principal: Math.round(principal) });
  }
  if (projection[projection.length - 1]?.age !== input.retireAge && years > 0) {
    const total =
      futureValue(input.kyosaiMonthly, years, 0.01) +
      futureValue(input.idecoMonthly + input.nisaMonthly, years, input.expectedReturn, input.investedAssets);
    projection.push({
      age: input.retireAge,
      total: Math.round(total),
      principal: Math.round(input.investedAssets + totalMonthlySaving * 12 * years),
    });
  }

  return {
    steps,
    monthlySurplus,
    totalMonthlySaving,
    annualTaxSaving,
    projection,
    retireTotal: projection[projection.length - 1]?.total ?? 0,
    suggestion: { kyosai, ideco, nisa, cashBuffer: Math.round(cashBuffer) },
  };
}

// 課税所得から所得税（復興税込み）＋住民税10%の限界税率を概算
export function marginalRate(taxableIncome: number): number {
  const brackets: [number, number][] = [
    [1_950_000, 0.05],
    [3_300_000, 0.1],
    [6_950_000, 0.2],
    [9_000_000, 0.23],
    [18_000_000, 0.33],
    [40_000_000, 0.4],
    [Infinity, 0.45],
  ];
  const rate = brackets.find(([upper]) => taxableIncome <= upper)![1];
  return rate * 1.021 + 0.1;
}
