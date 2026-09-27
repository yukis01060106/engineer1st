// フリーランスエンジニア向け・簡易手取り試算ロジック
// 注: 概算モデルです。正確な税額は税理士へご相談ください。

export interface RewardSimInput {
  monthlyRate: number; // 月単価（円、税抜）
  workingMonths: number; // 年間稼働月数
  expenseRatio: number; // 必要経費率（0〜1）
  isBlueTaxReturn: boolean; // 青色申告特別控除（65万円）の適用有無
}

export interface RewardSimResult {
  annualRevenue: number;
  expenses: number;
  blueReturnDeduction: number;
  basicDeduction: number;
  taxableIncome: number;
  incomeTax: number;
  residentTax: number;
  businessTax: number;
  nationalHealthInsurance: number;
  nationalPension: number;
  totalTaxAndInsurance: number;
  netIncomeAnnual: number;
  netIncomeMonthly: number;
}

function incomeTaxTable(taxableIncome: number): number {
  // 簡易累進課税テーブル（速算表・復興特別所得税は概算で1.021倍として後段で加味）
  const brackets: [number, number, number][] = [
    [1_950_000, 0.05, 0],
    [3_300_000, 0.1, 97_500],
    [6_950_000, 0.2, 427_500],
    [9_000_000, 0.23, 636_000],
    [18_000_000, 0.33, 1_536_000],
    [40_000_000, 0.4, 2_796_000],
    [Infinity, 0.45, 4_796_000],
  ];
  for (const [upper, rate, deduction] of brackets) {
    if (taxableIncome <= upper) {
      return Math.max(0, taxableIncome * rate - deduction);
    }
  }
  return 0;
}

export function simulateReward(input: RewardSimInput): RewardSimResult {
  const annualRevenue = Math.round(input.monthlyRate * input.workingMonths);
  const expenses = Math.round(annualRevenue * input.expenseRatio);
  const blueReturnDeduction = input.isBlueTaxReturn ? 650_000 : 0;
  const basicDeduction = 480_000;

  const taxableIncome = Math.max(
    0,
    annualRevenue - expenses - blueReturnDeduction - basicDeduction
  );

  const incomeTaxBase = incomeTaxTable(taxableIncome);
  const incomeTax = Math.round(incomeTaxBase * 1.021); // 復興特別所得税を概算加味

  const residentTax = Math.round(taxableIncome * 0.1);

  // 個人事業税（IT系エンジニアは業種次第だが概算で税率5%・事業主控除290万を適用）
  const businessTaxBase = Math.max(0, taxableIncome - 2_900_000);
  const businessTax = Math.round(businessTaxBase * 0.05);

  // 国民健康保険・国民年金は概算値（自治体・年度により変動）
  const nationalHealthInsurance = Math.min(
    990_000,
    Math.round(taxableIncome * 0.1)
  );
  const nationalPension = 204_000; // 令和6年度目安（月額約17,000円 x 12）

  const totalTaxAndInsurance =
    incomeTax +
    residentTax +
    businessTax +
    nationalHealthInsurance +
    nationalPension;

  const netIncomeAnnual = annualRevenue - expenses - totalTaxAndInsurance;
  const netIncomeMonthly = Math.round(netIncomeAnnual / 12);

  return {
    annualRevenue,
    expenses,
    blueReturnDeduction,
    basicDeduction,
    taxableIncome,
    incomeTax,
    residentTax,
    businessTax,
    nationalHealthInsurance,
    nationalPension,
    totalTaxAndInsurance,
    netIncomeAnnual,
    netIncomeMonthly,
  };
}

// 会社員（SES正社員など）の手取り概算。独立した場合との比較に使う
export interface SalaryResult {
  annualSalary: number;
  taxableIncome: number;
  socialInsurance: number;
  incomeTax: number;
  residentTax: number;
  netIncomeAnnual: number;
  netIncomeMonthly: number;
}

function employmentIncomeDeduction(salary: number): number {
  if (salary <= 1_625_000) return 550_000;
  if (salary <= 1_800_000) return salary * 0.4 - 100_000;
  if (salary <= 3_600_000) return salary * 0.3 + 80_000;
  if (salary <= 6_600_000) return salary * 0.2 + 440_000;
  if (salary <= 8_500_000) return salary * 0.1 + 1_100_000;
  return 1_950_000;
}

export function simulateSalary(annualSalary: number): SalaryResult {
  // 健康保険・厚生年金・雇用保険の本人負担を約15%で概算
  const socialInsurance = Math.round(annualSalary * 0.15);
  const taxableIncome = Math.max(
    0,
    annualSalary - employmentIncomeDeduction(annualSalary) - socialInsurance - 480_000
  );
  const incomeTax = Math.round(incomeTaxTable(taxableIncome) * 1.021);
  const residentTax = Math.round(taxableIncome * 0.1);
  const netIncomeAnnual = annualSalary - socialInsurance - incomeTax - residentTax;
  return {
    annualSalary,
    taxableIncome,
    socialInsurance,
    incomeTax,
    residentTax,
    netIncomeAnnual,
    netIncomeMonthly: Math.round(netIncomeAnnual / 12),
  };
}
