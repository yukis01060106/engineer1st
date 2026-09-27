"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Check, PiggyBank, Send, ShieldCheck, Sparkles, Trash2, Wand2 } from "lucide-react";
import { apiFetch, ApiError } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";
import { man, yen } from "../../../lib/format";

interface WealthStep {
  key: string;
  title: string;
  status: "done" | "doing" | "todo" | "skip";
  current: number;
  target: number;
  why: string;
}

interface Snapshot {
  age: number;
  current: { title: string; monthlyRate: number; daysLeft: number | null } | null;
  reward: { netIncomeMonthly: number } | null;
  monthlyNetIncome: number;
  isSelfEmployed: boolean;
  plan: Plan | null;
  wealth: {
    steps: WealthStep[];
    monthlySurplus: number;
    totalMonthlySaving: number;
    annualTaxSaving: number;
    projection: { age: number; total: number; principal: number }[];
    retireTotal: number;
    suggestion: { kyosai: number; ideco: number; nisa: number; cashBuffer: number };
  } | null;
}

interface Plan {
  monthlyLivingCost: number;
  cashSavings: number;
  investedAssets: number;
  kyosaiMonthly: number;
  idecoMonthly: number;
  nisaMonthly: number;
  expectedReturn: number;
  retireAge: number;
  annualSalary: number | null;
}

interface FpMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const DEFAULT_PLAN: Plan = {
  monthlyLivingCost: 250000,
  cashSavings: 0,
  investedAssets: 0,
  kyosaiMonthly: 0,
  idecoMonthly: 0,
  nisaMonthly: 0,
  expectedReturn: 0.03,
  retireAge: 65,
  annualSalary: null,
};

const SUGGESTIONS_FREELANCE = [
  "来月で案件が終わったらどうなる？",
  "単価が5万円上がったら手取りはいくら増える？",
  "iDeCoと小規模企業共済、どっちを先にやるべき？",
  "税金はいくら取り分けておけばいい？",
];
const SUGGESTIONS_EMPLOYEE = [
  "iDeCoとNISA、どっちを先にやるべき？",
  "生活防衛資金はいくら必要？",
  "独立したら何を準備すればいい？",
];

function YenInput({ label, value, onChange, max, hint }: { label: string; value: number; onChange: (v: number) => void; max?: number; hint?: string }) {
  return (
    <label>
      <span>
        {label} {hint && <span className="field-hint">{hint}</span>}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={1000}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(max ?? Infinity, Number(e.target.value) || 0)))}
      />
    </label>
  );
}

export default function WealthPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [plan, setPlan] = useState<Plan>(DEFAULT_PLAN);
  const [birthYear, setBirthYear] = useState<number>(new Date().getFullYear() - 32);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<FpMessage[]>([]);
  const [claudeEnabled, setClaudeEnabled] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<{ snapshot: Snapshot; birthYear: number | null }>("/wealth").then((r) => {
      setSnapshot(r.snapshot);
      if (r.snapshot.plan) setPlan(r.snapshot.plan);
      if (r.birthYear) setBirthYear(r.birthYear);
    });
    apiFetch<{ messages: FpMessage[]; claudeEnabled: boolean }>("/wealth/fp").then((r) => {
      setMessages(r.messages);
      setClaudeEnabled(r.claudeEnabled);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, asking]);

  async function savePlan(next: Plan = plan) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const r = await apiFetch<{ snapshot: Snapshot }>("/wealth/plan", {
        method: "PUT",
        body: JSON.stringify({ ...next, birthYear }),
      });
      setSnapshot(r.snapshot);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  function applySuggestion() {
    const s = snapshot?.wealth?.suggestion;
    if (!s) return;
    const next = { ...plan, kyosaiMonthly: s.kyosai, idecoMonthly: s.ideco, nisaMonthly: s.nisa };
    setPlan(next);
    savePlan(next);
  }

  async function ask(q: string) {
    if (!q.trim() || asking) return;
    const optimistic: FpMessage = { id: `tmp-${Date.now()}`, role: "user", content: q };
    setMessages((m) => [...m, optimistic]);
    setQuestion("");
    setAsking(true);
    try {
      const r = await apiFetch<{ reply: FpMessage }>("/wealth/fp", { method: "POST", body: JSON.stringify({ question: q }) });
      setMessages((m) => [...m, r.reply]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { id: `err-${Date.now()}`, role: "assistant", content: e instanceof ApiError ? e.message : "うまく答えられませんでした。時間をおいてもう一度お試しください。" },
      ]);
    } finally {
      setAsking(false);
    }
  }

  async function clearChat() {
    await apiFetch("/wealth/fp", { method: "DELETE" });
    setMessages([]);
  }

  const w = snapshot?.wealth;
  const selfEmployed = snapshot?.isSelfEmployed ?? true;
  const suggestions = selfEmployed ? SUGGESTIONS_FREELANCE : SUGGESTIONS_EMPLOYEE;
  const maxProjection = Math.max(1, ...(w?.projection.map((p) => p.total) ?? [1]));

  return (
    <div className="page">
      <PageHeader
        eyebrow="Future Plan"
        title="将来の備え・AI FP"
        description={
          selfEmployed
            ? "フリーランスには退職金も厚生年金もありません。あなたの契約単価と手取りをもとに、「生活防衛資金 → 小規模企業共済 → iDeCo → NISA」の順で無理のない積立額を試算します。"
            : "いまの年収と生活費から、「生活防衛資金 → iDeCo → NISA」の順で無理のない積立額を試算します。独立を考えている人は、独立後に必要になる備えもあわせて確認できます。"
        }
      />

      <div className="grid-main-side">
        <div className="stack-lg">
          <section className="panel">
            <div className="panel-head">
              <h2>
                <PiggyBank size={18} /> あなたの数字
              </h2>
              {snapshot && snapshot.monthlyNetIncome > 0 && (
                <span className="small muted">
                  手取り目安 <strong className="num">{yen(snapshot.monthlyNetIncome)}</strong>／月
                </span>
              )}
            </div>
            <div className="form-grid">
              <label>
                生まれた年
                <input type="number" min={1940} max={2010} value={birthYear} onChange={(e) => setBirthYear(Number(e.target.value))} />
              </label>
              <YenInput label="毎月の生活費" value={plan.monthlyLivingCost} onChange={(v) => setPlan({ ...plan, monthlyLivingCost: v })} />
              <YenInput label="いまの預金" value={plan.cashSavings} onChange={(v) => setPlan({ ...plan, cashSavings: v })} />
              <YenInput label="いまの投資資産" value={plan.investedAssets} onChange={(v) => setPlan({ ...plan, investedAssets: v })} />
              {!snapshot?.current && (
                <YenInput
                  label="いまの年収（額面）"
                  hint="手取りの計算に使います"
                  value={plan.annualSalary ?? 0}
                  onChange={(v) => setPlan({ ...plan, annualSalary: v || null })}
                />
              )}
            </div>
            <hr className="divider" />
            <div className="form-grid">
              {selfEmployed && (
                <YenInput label="小規模企業共済（月）" hint="上限7万円" max={70000} value={plan.kyosaiMonthly} onChange={(v) => setPlan({ ...plan, kyosaiMonthly: v })} />
              )}
              <YenInput
                label="iDeCo（月）"
                hint={selfEmployed ? "上限6.8万円" : "企業年金のない会社員は2.3万円まで"}
                max={selfEmployed ? 68000 : 23000}
                value={plan.idecoMonthly}
                onChange={(v) => setPlan({ ...plan, idecoMonthly: v })}
              />
              <YenInput label="NISA（月）" hint="つみたて枠は月10万円まで" max={300000} value={plan.nisaMonthly} onChange={(v) => setPlan({ ...plan, nisaMonthly: v })} />
              <label>
                想定利回り（年）{(plan.expectedReturn * 100).toFixed(1)}%
                <input type="range" min={0} max={0.07} step={0.005} value={plan.expectedReturn} onChange={(e) => setPlan({ ...plan, expectedReturn: Number(e.target.value) })} />
              </label>
              <label>
                受け取り始める年齢
                <input type="number" min={50} max={80} value={plan.retireAge} onChange={(e) => setPlan({ ...plan, retireAge: Number(e.target.value) })} />
              </label>
            </div>
            {error && <div className="form-error">{error}</div>}
            <div className="inline">
              <button className="btn-primary" onClick={() => savePlan()} disabled={saving}>
                {saving ? "計算中…" : "保存して試算する"}
              </button>
              {saved && (
                <span className="small" style={{ color: "var(--success)", fontWeight: 700 }}>
                  <Check size={14} /> 保存しました
                </span>
              )}
            </div>
          </section>

          {w && (
            <>
              <section className="panel">
                <div className="panel-head">
                  <h2>おすすめの順番</h2>
                  <span className="small muted">
                    生活費を引いた余力 <strong className="num">{yen(w.monthlySurplus)}</strong>／月
                  </span>
                </div>
                <div className="wealth-steps">
                  {w.steps.map((s, i) => (
                    <div key={s.key} className={`wealth-step is-${s.status}`}>
                      <span className="wealth-step-num">{s.status === "done" ? <Check size={18} /> : s.status === "skip" ? "−" : i + 1}</span>
                      <div className="stack" style={{ gap: 6 }}>
                        <div className="spread">
                          <strong>{s.title}</strong>
                          <span className="small num">
                            {s.status === "skip" ? "対象外" : s.key === "emergency" ? `${man(s.current)} / ${man(s.target)}` : `${yen(s.current)} / 月`}
                          </span>
                        </div>
                        {s.key === "emergency" && (
                          <div className="bar">
                            <span style={{ width: `${Math.min(100, (s.current / Math.max(1, s.target)) * 100)}%`, background: s.status === "done" ? "var(--mint)" : "var(--ink)" }} />
                          </div>
                        )}
                        <p className="small muted">{s.why}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="callout-inline callout-success">
                  <Wand2 size={16} />
                  <div style={{ flex: 1 }}>
                    いまの余力なら、{selfEmployed && (<>共済 <strong>{yen(w.suggestion.kyosai)}</strong>・</>)}iDeCo <strong>{yen(w.suggestion.ideco)}</strong>・NISA{" "}
                    <strong>{yen(w.suggestion.nisa)}</strong>（月）が無理のない目安です
                    {w.suggestion.cashBuffer > 0 && `。生活防衛資金が貯まるまでは、ほかに月${man(w.suggestion.cashBuffer)}を現金で残しましょう`}。
                    余力の2割は、自由に使える分として残しています。
                  </div>
                  <button className="btn-primary btn-sm" onClick={applySuggestion}>
                    反映する
                  </button>
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h2>{plan.retireAge}歳までの見通し</h2>
                </div>
                <div className="stat-row">
                  <div className="stat-tile">
                    <div className="stat-label">{plan.retireAge}歳時点の試算</div>
                    <div className="stat-value">{man(w.retireTotal).replace("万円", "")}<small>万円</small></div>
                  </div>
                  <div className="stat-tile">
                    <div className="stat-label">毎月の積立</div>
                    <div className="stat-value">{man(w.totalMonthlySaving).replace("万円", "")}<small>万円</small></div>
                  </div>
                  <div className="stat-tile">
                    <div className="stat-label">共済・iDeCoの節税（年）</div>
                    <div className="stat-value">{man(w.annualTaxSaving).replace("万円", "")}<small>万円</small></div>
                  </div>
                </div>
                {w.totalMonthlySaving === 0 && plan.investedAssets === 0 && (
                  <div className="callout-inline callout-info">
                    <Wand2 size={16} />
                    <span>積立額を入れるか、上の「反映する」を押すと、{plan.retireAge}歳までの見通しが表示されます。</span>
                  </div>
                )}
                <div className="projection" role="img" aria-label="年齢ごとの資産の見通し">
                  {w.projection.map((p) => (
                    <div className="projection-row" key={p.age}>
                      <span className="num muted">{p.age}歳</span>
                      <div className="projection-track">
                        <span className="total" style={{ width: `${(p.total / maxProjection) * 100}%` }} />
                        <span className="principal" style={{ width: `${(Math.min(p.principal, p.total) / maxProjection) * 100}%` }} />
                      </div>
                      <span className="num small" style={{ textAlign: "right" }}>
                        {man(p.total)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="legend">
                  <span className="legend-item">
                    <span className="legend-swatch" style={{ background: "var(--ink)" }} /> 積み立てた元本
                  </span>
                  <span className="legend-item">
                    <span className="legend-swatch" style={{ background: "var(--primary)" }} /> 運用益（想定）
                  </span>
                </div>
                <p className="disclaimer">
                  ※ 共済は利回り1%、iDeCo・NISAは想定利回りで計算した概算です。将来の運用成果を約束するものではありません。特定の金融商品をおすすめするものではありません。
                </p>
              </section>
            </>
          )}
        </div>

        {/* AI FP */}
        <section className="panel" style={{ position: "sticky", top: 24 }}>
          <div className="panel-head">
            <h2>
              <Bot size={18} /> AI FPに相談
            </h2>
            <span className={`badge ${claudeEnabled ? "badge-violet" : ""}`}>
              {claudeEnabled ? (
                <>
                  <Sparkles size={12} /> Claude
                </>
              ) : (
                "簡易モード"
              )}
            </span>
          </div>
          <p className="small muted">
            あなたの契約単価・契約終了日・入金状況・積立プランを前提に答えます。
          </p>
          <div className="chat-window" style={{ height: 460, minHeight: 0 }}>
            <div className="chat-messages" aria-live="polite">
              {messages.length === 0 && (
                <div className="chat-bubble chat-bubble-staff">
                  こんにちは。AI FPです。
                  {selfEmployed
                    ? `${snapshot?.current ? `いまは「${snapshot.current.title}」で月${man(snapshot.current.monthlyRate)}ですね。` : ""}税金の取り分け、案件が途切れたときの備え、共済・iDeCo・NISAの順番など、気軽に聞いてください。`
                    : "生活防衛資金、iDeCoとNISAの順番、独立する前に準備しておきたいことなど、気軽に聞いてください。"}
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`chat-bubble ${m.role === "user" ? "chat-bubble-user" : "chat-bubble-staff"}`}>
                  {m.content}
                </div>
              ))}
              {asking && (
                <div className="chat-bubble chat-bubble-staff" aria-label="考えています">
                  <span className="typing">
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div>
              <div className="chat-suggest">
                {suggestions.map((s) => (
                  <button key={s} className="chip" style={{ minHeight: 32, fontSize: 12 }} onClick={() => ask(s)} disabled={asking}>
                    {s}
                  </button>
                ))}
              </div>
              <form
                className="chat-input-row"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  ask(question);
                }}
              >
                <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="税金・積立・将来の備えについて聞いてみる" aria-label="AI FPへの質問" maxLength={1000} />
                <button className="btn-primary" type="submit" disabled={asking || !question.trim()} aria-label="送信">
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>
          <div className="spread">
            <span className="small muted inline" style={{ gap: 4 }}>
              <ShieldCheck size={14} /> 個別の金融商品はおすすめしません
            </span>
            {messages.length > 0 && (
              <button className="btn-ghost btn-sm" onClick={clearChat}>
                <Trash2 size={14} /> 履歴を消す
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
