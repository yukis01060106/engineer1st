"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Briefcase, Gauge, MessagesSquare } from "lucide-react";
import { apiFetch, ApiError } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";
import { fmtDate, man } from "../../../lib/format";

interface DiagnosisResult {
  comparisonRate: number;
  dataSource: "similar_users" | "industry_baseline";
  sampleSize: number;
  diffRatio: number;
  message: string;
  chainDepthNote: string | null;
  disclaimer: string;
}

interface PastDiagnosis {
  id: string;
  primarySkill: string;
  role: string;
  monthlyRate: number;
  createdAt: string;
}

const ROLE_OPTIONS = [
  "フロントエンドエンジニア",
  "バックエンドエンジニア",
  "インフラエンジニア",
  "フルスタックエンジニア",
  "データエンジニア",
  "PM/PMO",
];

// スキル名から役割のあたりをつける（入力の手間を減らすための初期値）
function guessRole(skill: string) {
  const s = skill.toLowerCase();
  if (["react", "vue", "next.js", "typescript"].includes(s)) return "フロントエンドエンジニア";
  if (["aws", "kubernetes", "terraform", "gcp"].includes(s)) return "インフラエンジニア";
  if (["python", "sql", "spark"].includes(s)) return "データエンジニア";
  return "バックエンドエンジニア";
}

export default function RateDiagnosisPage() {
  const [primarySkill, setPrimarySkill] = useState("");
  const [role, setRole] = useState(ROLE_OPTIONS[0]);
  const [yearsOfExperience, setYearsOfExperience] = useState(3);
  const [monthlyRateMan, setMonthlyRateMan] = useState(70);
  const [chainDepth, setChainDepth] = useState<string>("");
  const [prefilled, setPrefilled] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [history, setHistory] = useState<PastDiagnosis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // スキルシートと稼働中の単価から、わかっている項目を先に埋めておく
    Promise.all([
      apiFetch<{ skillSheet: { skills: { name: string; level: number; years: number }[]; totalExperienceYears: number | null } | null }>("/skill-sheet").catch(() => null),
      apiFetch<{ currentEngagement: { monthlyRate: number } | null }>("/mypage").catch(() => null),
    ]).then(([sheet, me]) => {
      const skills = sheet?.skillSheet?.skills ?? [];
      const top = [...skills].sort((a, b) => b.level - a.level || b.years - a.years)[0];
      if (top) {
        setPrimarySkill(top.name);
        setRole(guessRole(top.name));
        setYearsOfExperience(sheet?.skillSheet?.totalExperienceYears ?? top.years);
        setPrefilled(true);
      }
      if (me?.currentEngagement) {
        setMonthlyRateMan(Math.round(me.currentEngagement.monthlyRate / 10_000));
        setPrefilled(true);
      }
    });
    loadHistory();
  }, []);

  function loadHistory() {
    apiFetch<{ diagnoses: PastDiagnosis[] }>("/rate-diagnosis/mine")
      .then((r) => setHistory(r.diagnoses.slice(0, 5)))
      .catch(() => undefined);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ result: DiagnosisResult }>("/rate-diagnosis", {
        method: "POST",
        body: JSON.stringify({
          primarySkill: primarySkill.trim(),
          role,
          yearsOfExperience,
          monthlyRate: monthlyRateMan * 10_000,
          chainDepth: chainDepth ? Number(chainDepth) : undefined,
        }),
      });
      setResult(res.result);
      loadHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "診断できませんでした");
    } finally {
      setLoading(false);
    }
  }

  const mine = monthlyRateMan * 10_000;
  const scaleMax = result ? Math.max(mine, result.comparisonRate) * 1.15 : 1;
  const tone = !result ? "" : result.diffRatio <= -5 ? "low" : result.diffRatio >= 5 ? "high" : "even";

  return (
    <div className="page">
      <PageHeader
        eyebrow="Rate Check"
        title="単価・商流診断"
        description={<>似た条件（役割・主要スキル・経験年数）のエンジニアの申告データと比べて、いまの単価の位置づけをお伝えします。個人の契約を断定するものではなく、次の更新や交渉の参考にしてください。</>}
      />

      <div className="grid-main-side">
        <form className="panel sim-form" style={{ maxWidth: "none" }} onSubmit={handleSubmit}>
          <div className="panel-head">
            <h2>
              <Gauge size={18} /> 条件を入れる
            </h2>
          </div>
          {prefilled && <p className="small muted">スキルシートと、登録中の取引先の単価から入力しています。違うところだけ直してください。</p>}
          <div className="form-grid">
            <label>
              主要スキル
              <input value={primarySkill} onChange={(e) => setPrimarySkill(e.target.value)} placeholder="例：React" required />
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
              <input type="number" min={0} max={50} value={yearsOfExperience} onChange={(e) => setYearsOfExperience(Number(e.target.value))} />
            </label>
            <label>
              月単価（万円・税抜）
              <input type="number" min={1} step={1} value={monthlyRateMan} onChange={(e) => setMonthlyRateMan(Number(e.target.value))} required />
            </label>
          </div>
          <label>
            商流の階層 <span className="field-hint">任意・分かる範囲で。元請けから2社目なら「2」</span>
            <input type="number" min={1} max={10} placeholder="例：2" value={chainDepth} onChange={(e) => setChainDepth(e.target.value)} style={{ maxWidth: 200 }} />
          </label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="btn-primary" type="submit" disabled={loading || !primarySkill.trim() || monthlyRateMan <= 0} style={{ justifySelf: "start" }}>
            {loading ? "診断中…" : "診断する"}
          </button>
        </form>

        <section className="panel">
          <div className="panel-head">
            <h2>これまでの診断</h2>
          </div>
          {history.length === 0 ? (
            <p className="small muted">まだ診断していません。入力したデータは匿名で集計され、ほかのエンジニアの比較にも役立ちます。</p>
          ) : (
            <ul className="plan-list" style={{ marginTop: 0 }}>
              {history.map((h) => (
                <li key={h.id}>
                  <span className="small muted num plan-time" style={{ width: "5.5em" }}>{fmtDate(h.createdAt)}</span>
                  <span className="plan-title small">
                    {h.primarySkill}・{h.role}
                  </span>
                  <strong className="num small">{man(h.monthlyRate)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {result && (
        <section className="panel stack" aria-live="polite">
          <div className="panel-head">
            <h2>診断結果</h2>
            <span className="badge">
              {result.dataSource === "similar_users" ? `似た条件の ${result.sampleSize}件と比較` : "業界の公開データ（参考値）と比較"}
            </span>
          </div>
          <p style={{ fontSize: 17, fontWeight: 700 }}>{result.message}</p>

          <div className="stack" style={{ gap: 10 }}>
            {[
              { label: "あなた", value: mine, color: "var(--primary)" },
              { label: "比較の目安", value: result.comparisonRate, color: "var(--line-strong)" },
            ].map((b) => (
              <div key={b.label} className="skillgap-row" style={{ gridTemplateColumns: "90px 1fr 110px" }}>
                <div className="small" style={{ fontWeight: 700 }}>{b.label}</div>
                <div className="skillgap-bar-track">
                  <div className="skillgap-bar-market" style={{ width: `${(b.value / scaleMax) * 100}%`, background: b.color }} />
                </div>
                <div className="num" style={{ fontWeight: 700 }}>{man(b.value)}</div>
              </div>
            ))}
          </div>

          {result.chainDepthNote && (
            <div className={"callout-inline " + (chainDepth && Number(chainDepth) >= 3 ? "callout-warning" : "callout-info")}>
              <AlertTriangle size={16} />
              <div>{result.chainDepthNote}</div>
            </div>
          )}

          <div className="stack" style={{ gap: 8 }}>
            <strong className="small">次にできること</strong>
            <div className="inline">
              {tone === "low" && (
                <Link href="/chat" className="btn-primary btn-sm">
                  <MessagesSquare size={14} /> 担当者に単価の相談をする
                </Link>
              )}
              <Link href={`/projects?q=${encodeURIComponent(primarySkill)}`} className={tone === "low" ? "btn-secondary btn-sm" : "btn-primary btn-sm"}>
                <Briefcase size={14} /> {primarySkill}の案件を見る
              </Link>
              <Link href="/skill-gap" className="btn-secondary btn-sm">
                伸ばすと効くスキルを見る <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          <p className="disclaimer">{result.disclaimer}</p>
        </section>
      )}
    </div>
  );
}
