"use client";

import { useState } from "react";
import { apiFetch } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";

interface DiagnosisResult {
  comparisonRate: number;
  dataSource: "similar_users" | "industry_baseline";
  sampleSize: number;
  diffRatio: number;
  message: string;
  chainDepthNote: string | null;
  disclaimer: string;
}

const ROLE_OPTIONS = [
  "フロントエンドエンジニア",
  "バックエンドエンジニア",
  "インフラエンジニア",
  "フルスタックエンジニア",
  "データエンジニア",
  "PM/PMO",
];

const yen = (n: number) => `${Math.round(n).toLocaleString()}円`;

export default function RateDiagnosisPage() {
  const [primarySkill, setPrimarySkill] = useState("React");
  const [role, setRole] = useState(ROLE_OPTIONS[0]);
  const [yearsOfExperience, setYearsOfExperience] = useState(3);
  const [monthlyRate, setMonthlyRate] = useState(700000);
  const [chainDepth, setChainDepth] = useState<string>("");
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await apiFetch<{ result: DiagnosisResult }>("/rate-diagnosis", {
        method: "POST",
        body: JSON.stringify({
          primarySkill,
          role,
          yearsOfExperience,
          monthlyRate,
          chainDepth: chainDepth ? Number(chainDepth) : undefined,
        }),
      });
      setResult(res.result);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Rate Check"
        title="単価・商流診断"
        description={<>似た条件（役割・主要スキル・経験年数）のエンジニアの申告データと比較して、あなたの単価の目安をお伝えします。 個人の契約を断定するものではなく、参考情報としてご活用ください。使う人が増えるほど比較の精度が上がります。</>}
      />

      <section className="section sim-form">
        <label>
          主要スキル
          <input value={primarySkill} onChange={(e) => setPrimarySkill(e.target.value)} placeholder="React" />
        </label>
        <label>
          役割
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label>
          経験年数
          <input
            type="number"
            min={0}
            value={yearsOfExperience}
            onChange={(e) => setYearsOfExperience(Number(e.target.value))}
          />
        </label>
        <label>
          月単価（円）
          <input type="number" value={monthlyRate} onChange={(e) => setMonthlyRate(Number(e.target.value))} />
        </label>
        <label>
          商流の階層（任意・分かる範囲で）
          <input
            type="number"
            min={1}
            max={10}
            placeholder="例: 元請けから2社目なら 2"
            value={chainDepth}
            onChange={(e) => setChainDepth(e.target.value)}
          />
        </label>
        <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? "診断中..." : "診断する"}
        </button>
      </section>

      {result && (
        <section className="section">
          <div className="card highlight-card">
            <div className="card-label">
              {result.dataSource === "similar_users"
                ? `似た条件のエンジニア ${result.sampleSize}件のデータと比較`
                : "業界の公開データ（参考値）と比較"}
            </div>
            <p>{result.message}</p>
            <div className="card-sub">比較対象の目安単価: {yen(result.comparisonRate)}</div>
          </div>

          {result.chainDepthNote && (
            <div className="alert-item alert-engagement-ending">
              <div className="alert-message">{result.chainDepthNote}</div>
            </div>
          )}

          <p className="disclaimer">{result.disclaimer}</p>
        </section>
      )}
    </div>
  );
}
