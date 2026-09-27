"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Scale } from "lucide-react";
import { apiFetch } from "../../../api/client";
import { useAuth } from "../../../context/AuthContext";
import { PageHeader } from "../../../components/PageHeader";
import { yen, man } from "../../../lib/format";
import Link from "next/link";

interface SimResult {
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

interface SalaryResult {
  annualSalary: number;
  socialInsurance: number;
  incomeTax: number;
  residentTax: number;
  netIncomeAnnual: number;
  netIncomeMonthly: number;
}

export default function RewardSimPage() {
  const { user } = useAuth();
  const isEmployee = user?.workStyle !== "freelance";
  const [monthlyRate, setMonthlyRate] = useState(700000);
  const [workingMonths, setWorkingMonths] = useState(12);
  const [expenseRatio, setExpenseRatio] = useState(20);
  const [isBlueTaxReturn, setIsBlueTaxReturn] = useState(true);
  const [salary, setSalary] = useState(5_000_000);
  const [compare, setCompare] = useState(isEmployee);
  const [result, setResult] = useState<SimResult | null>(null);
  const [salaryResult, setSalaryResult] = useState<SalaryResult | null>(null);

  // 入力のたびに自動で再計算
  useEffect(() => {
    if (!monthlyRate) return;
    const t = setTimeout(() => {
      apiFetch<{ result: SimResult; salary: SalaryResult | null }>("/reward-sim", {
        method: "POST",
        body: JSON.stringify({
          monthlyRate,
          workingMonths,
          expenseRatio: expenseRatio / 100,
          isBlueTaxReturn,
          ...(compare && salary > 0 ? { currentSalary: salary } : {}),
        }),
      }).then((r) => {
        setResult(r.result);
        setSalaryResult(r.salary);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [monthlyRate, workingMonths, expenseRatio, isBlueTaxReturn, salary, compare]);

  const diff = result && salaryResult ? result.netIncomeAnnual - salaryResult.netIncomeAnnual : null;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Simulator"
        title={isEmployee ? "独立したら、手取りはいくら？" : "手取りシミュレーション"}
        description="月単価から、税金・社会保険料を差し引いた手取りを概算します。会社員の年収と並べて比べることもできます。"
      />

      <div className="grid-main-side">
        <section className="panel">
          <div className="form-grid">
            <label>
              月単価 {man(monthlyRate)}
              <input type="range" min={300000} max={1500000} step={10000} value={monthlyRate} onChange={(e) => setMonthlyRate(Number(e.target.value))} />
            </label>
            <label>
              年間の稼働月数 {workingMonths}か月
              <input type="range" min={1} max={12} value={workingMonths} onChange={(e) => setWorkingMonths(Number(e.target.value))} />
            </label>
            <label>
              経費率 {expenseRatio}%
              <input type="range" min={0} max={50} value={expenseRatio} onChange={(e) => setExpenseRatio(Number(e.target.value))} />
            </label>
          </div>
          <label className="checkbox-label">
            <input type="checkbox" checked={isBlueTaxReturn} onChange={(e) => setIsBlueTaxReturn(e.target.checked)} />
            青色申告特別控除（65万円）を使う
          </label>
          <hr className="divider" />
          <label className="checkbox-label">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
            会社員の年収と比べる
          </label>
          {compare && (
            <label>
              いまの年収（額面） {man(salary)}
              <input type="range" min={3000000} max={12000000} step={100000} value={salary} onChange={(e) => setSalary(Number(e.target.value))} />
            </label>
          )}
        </section>

        {result && (
          <section className="panel highlight-card" style={{ gap: 18 }}>
            <div className="stack" style={{ gap: 4 }}>
              <span className="card-label">フリーランスの手取り（月あたり）</span>
              <span className="big-number">{yen(result.netIncomeMonthly)}</span>
              <span className="card-sub">年間 {man(result.netIncomeAnnual)}（売上 {man(result.annualRevenue)}）</span>
            </div>
            {salaryResult && diff != null && (
              <div className="stack" style={{ gap: 6, borderTop: "1px solid rgba(255,255,255,.2)", paddingTop: 16 }}>
                <span className="card-label inline" style={{ gap: 6 }}>
                  <Scale size={14} /> 会社員（年収{man(salaryResult.annualSalary)}）の手取り
                </span>
                <span style={{ fontFamily: "var(--font-en)", fontWeight: 800, fontSize: 24 }}>{yen(salaryResult.netIncomeMonthly)}／月</span>
                <span className="badge" style={{ background: diff >= 0 ? "var(--yellow)" : "var(--pink)", color: "var(--ink)", justifySelf: "start", fontSize: 13, padding: "6px 12px" }}>
                  年間 {diff >= 0 ? "+" : "−"}
                  {man(Math.abs(diff))} {diff >= 0 ? "増える見込み" : "減る見込み"}
                </span>
                <span className="card-sub small">
                  ※ 会社員には厚生年金・有給・退職金があり、フリーランスは自分で備える必要があります。差額の一部は
                  <Link href="/wealth" style={{ textDecoration: "underline" }}>小規模企業共済・iDeCo</Link>に回すのがおすすめです。
                </span>
              </div>
            )}
          </section>
        )}
      </div>

      {result && (
        <section className="panel">
          <div className="panel-head">
            <h2>内訳</h2>
          </div>
          <div className="table-wrap">
            <table className="sim-table">
              <tbody>
                <tr><td>年間売上</td><td>{yen(result.annualRevenue)}</td></tr>
                <tr><td>必要経費</td><td>−{yen(result.expenses)}</td></tr>
                <tr><td>青色申告特別控除</td><td>−{yen(result.blueReturnDeduction)}</td></tr>
                <tr><td>基礎控除</td><td>−{yen(result.basicDeduction)}</td></tr>
                <tr className="sim-table-highlight"><td>課税所得</td><td>{yen(result.taxableIncome)}</td></tr>
                <tr><td>所得税（復興特別所得税を含む）</td><td>−{yen(result.incomeTax)}</td></tr>
                <tr><td>住民税</td><td>−{yen(result.residentTax)}</td></tr>
                <tr><td>個人事業税</td><td>−{yen(result.businessTax)}</td></tr>
                <tr><td>国民健康保険（概算）</td><td>−{yen(result.nationalHealthInsurance)}</td></tr>
                <tr><td>国民年金</td><td>−{yen(result.nationalPension)}</td></tr>
                <tr className="sim-table-highlight"><td>手取り（年）</td><td>{yen(result.netIncomeAnnual)}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="disclaimer">
            ※ 概算モデルによる試算です。実際の税額・保険料は自治体や扶養・控除の状況で変わります。正確な金額は税理士にご確認ください。
          </p>
          <Link href="/wealth" className="btn-link">
            手取りから、積立の目安を出す <ArrowRight size={14} />
          </Link>
        </section>
      )}
    </div>
  );
}
