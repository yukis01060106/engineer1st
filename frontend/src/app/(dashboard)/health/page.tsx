"use client";

import { FormEvent, useEffect, useReducer, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, Check, Moon, Footprints, Pause, Play, RotateCcw, Stethoscope, Timer, Users } from "lucide-react";
import { apiFetch, ApiError } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";
import { fmtDate } from "../../../lib/format";

interface DayLog {
  date: string;
  steps: number | null;
  sleepHours: number | null;
  exerciseMin: number | null;
  mood: number | null;
}

interface HealthData {
  today: string;
  series: DayLog[];
  weekly: { steps: number | null; sleepHours: number | null; exerciseMin: number; mood: number | null; loggedDays: number };
  checkup: { lastDate: string | null; daysSince: number | null; due: boolean };
  clubs: { slug: string; name: string }[];
}

const MOODS = ["😣", "😕", "😐", "🙂", "😄"];

const METRICS = [
  { key: "steps", label: "歩数", unit: "歩", goal: 8000, icon: Footprints },
  { key: "sleepHours", label: "睡眠", unit: "時間", goal: 7, icon: Moon },
  { key: "exerciseMin", label: "運動", unit: "分", goal: 30, icon: Activity },
] as const;

// 座りっぱなしリセット（1時間に1回・約3分）
const STRETCHES = [
  { name: "首のストレッチ", sec: 30, how: "頭をゆっくり右に倒して15秒、左に倒して15秒。肩は下げたまま。" },
  { name: "肩甲骨まわし", sec: 30, how: "両手を肩に置き、ひじで大きな円を描くように前後10回ずつ。" },
  { name: "胸を開く", sec: 30, how: "背中で手を組み、胸を張って斜め上を見る。猫背のリセットに。" },
  { name: "手首・前腕", sec: 30, how: "腕を前に伸ばし、反対の手で指先を手前に引く。左右15秒ずつ。" },
  { name: "腰・お尻", sec: 40, how: "座ったまま片足をもう片方のひざにのせ、上体を前へ。左右20秒ずつ。" },
  { name: "遠くを見る", sec: 20, how: "窓の外など6m以上先を20秒見る。目のピント調節を休ませます。" },
];

type TimerState = { idx: number; left: number; running: boolean; done: boolean };
type TimerAction = { type: "tick" } | { type: "toggle" } | { type: "reset" };
const TIMER_INIT: TimerState = { idx: 0, left: STRETCHES[0].sec, running: false, done: false };

function timerReducer(st: TimerState, a: TimerAction): TimerState {
  switch (a.type) {
    case "toggle":
      return { ...st, running: !st.running };
    case "reset":
      return TIMER_INIT;
    case "tick":
      if (!st.running) return st;
      if (st.left > 1) return { ...st, left: st.left - 1 };
      if (st.idx + 1 >= STRETCHES.length) return { ...st, left: 0, running: false, done: true };
      return { ...st, idx: st.idx + 1, left: STRETCHES[st.idx + 1].sec };
  }
}

function StretchTimer() {
  const [{ idx, left, running, done }, dispatch] = useReducer(timerReducer, TIMER_INIT);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(t);
  }, [running]);

  const reset = () => dispatch({ type: "reset" });
  const s = STRETCHES[idx];
  return (
    <div className="stack">
      <div className="spread" style={{ alignItems: "flex-end" }}>
        <div className="stack" style={{ gap: 4 }}>
          <span className="stretch-time">
            {done ? "COMPLETE" : `${idx + 1} / ${STRETCHES.length}`}
          </span>
          <strong style={{ fontSize: 18 }}>{done ? "おつかれさまでした！" : s.name}</strong>
          <p className="small muted" style={{ maxWidth: 420 }}>
            {done ? "また1時間後に。水も1杯どうぞ。" : s.how}
          </p>
        </div>
        <div className="timer" aria-live="polite">
          {done ? <Check size={40} /> : `0:${String(left).padStart(2, "0")}`}
        </div>
      </div>
      <div className="bar">
        <span style={{ width: `${done ? 100 : ((idx + (s.sec - left) / s.sec) / STRETCHES.length) * 100}%`, background: "var(--primary)" }} />
      </div>
      <div className="inline">
        {!done && (
          <button className="btn-primary" onClick={() => dispatch({ type: "toggle" })}>
            {running ? <Pause size={16} /> : <Play size={16} />} {running ? "一時停止" : idx === 0 && left === STRETCHES[0].sec ? "3分ストレッチを始める" : "再開"}
          </button>
        )}
        <button className="btn-ghost" onClick={reset}>
          <RotateCcw size={16} /> 最初から
        </button>
      </div>
    </div>
  );
}

export default function HealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [metric, setMetric] = useState<(typeof METRICS)[number]["key"]>("steps");
  const [form, setForm] = useState({ steps: "", sleepHours: "", exerciseMin: "", mood: 0 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkupDate, setCheckupDate] = useState("");

  function load() {
    apiFetch<HealthData>("/health").then((d) => {
      setData(d);
      const t = d.series.find((s) => s.date === d.today);
      if (t) {
        setForm({
          steps: t.steps?.toString() ?? "",
          sleepHours: t.sleepHours?.toString() ?? "",
          exerciseMin: t.exerciseMin?.toString() ?? "",
          mood: t.mood ?? 0,
        });
      }
    });
  }
  useEffect(load, []);

  async function saveLog(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    const num = (v: string) => (v === "" ? null : Number(v));
    try {
      await apiFetch("/health/logs", {
        method: "PUT",
        body: JSON.stringify({
          date: data.today,
          steps: num(form.steps),
          sleepHours: num(form.sleepHours),
          exerciseMin: num(form.exerciseMin),
          mood: form.mood || null,
        }),
      });
      setSaved(true);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function saveCheckup() {
    if (!checkupDate) return;
    await apiFetch("/health/checkup", { method: "PUT", body: JSON.stringify({ lastCheckupDate: checkupDate }) });
    setCheckupDate("");
    load();
  }

  if (!data) return <div className="page"><div className="skeleton" style={{ height: 300 }} /></div>;

  const m = METRICS.find((x) => x.key === metric)!;
  const values = data.series.map((d) => d[metric]);
  const max = Math.max(m.goal, ...values.map((v) => v ?? 0));

  return (
    <div className="page">
      <PageHeader
        eyebrow="Health"
        title="健康"
        description="座りっぱなし・運動不足・健診の受け忘れは、フリーランスがつまずきやすいところ。毎日のコンディションを10秒で記録して、部活で体を動かしましょう。"
      />

      <div className="stat-row">
        <div className="stat-tile" style={{ background: "#fff", border: "1px solid var(--line)" }}>
          <div className="stat-label">歩数（7日平均）</div>
          <div className="stat-value">{data.weekly.steps != null ? Math.round(data.weekly.steps).toLocaleString() : "—"}<small>歩</small></div>
        </div>
        <div className="stat-tile" style={{ background: "#fff", border: "1px solid var(--line)" }}>
          <div className="stat-label">睡眠（7日平均）</div>
          <div className="stat-value">{data.weekly.sleepHours ?? "—"}<small>時間</small></div>
        </div>
        <div className="stat-tile" style={{ background: "#fff", border: "1px solid var(--line)" }}>
          <div className="stat-label">運動（7日合計）</div>
          <div className="stat-value">{data.weekly.exerciseMin}<small>分</small></div>
          <div className="stat-sub">目安は週150分</div>
        </div>
        <div className="stat-tile" style={{ background: "#fff", border: "1px solid var(--line)" }}>
          <div className="stat-label">気分（7日平均）</div>
          <div className="stat-value">{data.weekly.mood ? MOODS[Math.round(data.weekly.mood) - 1] : "—"}</div>
        </div>
      </div>

      <div className="grid-main-side">
        <section className="panel">
          <div className="panel-head">
            <h2>
              <m.icon size={18} /> 14日間の{m.label}
            </h2>
            <div className="tabs">
              {METRICS.map((x) => (
                <button key={x.key} className="chip" style={{ minHeight: 32 }} aria-pressed={metric === x.key} onClick={() => setMetric(x.key)}>
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-bars" role="img" aria-label={`${m.label}の推移`}>
            {data.series.map((d) => {
              const v = d[metric];
              return (
                <div className="col" key={d.date} title={`${d.date}: ${v ?? "未記録"}${v != null ? m.unit : ""}`}>
                  <span
                    className={`fill ${v == null ? "is-empty" : ""} ${d.date === data.today ? "is-today" : ""}`}
                    style={{ height: v == null ? 6 : `${Math.max(4, (v / max) * 100)}%` }}
                  />
                  <span className="lbl">{Number(d.date.slice(8))}</span>
                </div>
              );
            })}
          </div>
          <p className="small muted">
            目標ライン：{m.goal.toLocaleString()}
            {m.unit}／日
          </p>
        </section>

        <form className="panel" onSubmit={saveLog}>
          <div className="panel-head">
            <h2>今日の記録</h2>
            <span className="small muted">{fmtDate(data.today)}</span>
          </div>
          <div className="form-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <label>
              歩数
              <input type="number" inputMode="numeric" min={0} value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })} placeholder="6000" />
            </label>
            <label>
              睡眠(h)
              <input type="number" inputMode="decimal" min={0} max={24} step={0.5} value={form.sleepHours} onChange={(e) => setForm({ ...form, sleepHours: e.target.value })} placeholder="7" />
            </label>
            <label>
              運動(分)
              <input type="number" inputMode="numeric" min={0} value={form.exerciseMin} onChange={(e) => setForm({ ...form, exerciseMin: e.target.value })} placeholder="30" />
            </label>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <span className="small" style={{ fontWeight: 700, color: "var(--ink-2)" }}>
              気分
            </span>
            <div className="mood-picker" role="radiogroup" aria-label="気分">
              {MOODS.map((e, i) => (
                <button type="button" key={e} role="radio" aria-checked={form.mood === i + 1} onClick={() => setForm({ ...form, mood: i + 1 })}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? "保存中…" : saved ? (<><Check size={16} /> 保存しました</>) : "記録する"}
          </button>
        </form>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>
            <Timer size={18} /> 座りっぱなしリセット（約3分）
          </h2>
          <span className="small muted">1時間に1回がおすすめ</span>
        </div>
        <StretchTimer />
        <div className="stretch-grid">
          {STRETCHES.map((s) => (
            <div className="stretch" key={s.name}>
              <span className="stretch-time">{s.sec} SEC</span>
              <strong style={{ fontSize: 14 }}>{s.name}</strong>
              <p className="small muted">{s.how}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid-2">
        <section className="panel" style={data.checkup.due ? { borderColor: "var(--warning)" } : undefined}>
          <div className="panel-head">
            <h2>
              <Stethoscope size={18} /> 健康診断
            </h2>
            {data.checkup.due ? <span className="badge badge-warning">受診の時期です</span> : <span className="badge badge-success">受診済み</span>}
          </div>
          <p className="small">
            {data.checkup.lastDate
              ? `前回：${fmtDate(data.checkup.lastDate)}（${Math.floor((data.checkup.daysSince ?? 0) / 30)}か月前）`
              : "まだ受診日が登録されていません。"}
          </p>
          <ul className="small muted" style={{ margin: 0, paddingLeft: "1.2em", display: "grid", gap: 4 }}>
            <li>会社員と違い、フリーランスは健診を自分で予約する必要があります</li>
            <li>国民健康保険に入っている40〜74歳は、自治体の特定健診を無料〜数百円で受けられます</li>
            <li>40歳未満でも、自治体によっては若年者健診やがん検診の補助があります</li>
          </ul>
          <div className="inline">
            <input type="date" value={checkupDate} onChange={(e) => setCheckupDate(e.target.value)} style={{ maxWidth: 200 }} aria-label="受診日" />
            <button className="btn-secondary btn-sm" onClick={saveCheckup} disabled={!checkupDate}>
              受診日を記録
            </button>
          </div>
        </section>

        <section className="panel" style={{ background: "var(--yellow-soft)", borderColor: "transparent" }}>
          <div className="panel-head">
            <h2>
              <Users size={18} /> 体を動かすなら、部活で
            </h2>
          </div>
          <p className="small">
            {data.clubs.length > 0
              ? `いま「${data.clubs.map((c) => c.name).join("・")}」に入っています。次の活動に申し込んでおきましょう。`
              : "ひとりだと続かない運動も、仲間がいれば続きます。まずは見学気分で。"}
          </p>
          <Link href={data.clubs.length > 0 ? "/community" : "/clubs"} className="btn-primary" style={{ justifySelf: "start" }}>
            {data.clubs.length > 0 ? "次の活動を見る" : "部活を見る"} <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <p className="disclaimer">※ このページは健康づくりのための記録です。体調に不安があるときは医療機関にご相談ください。</p>
    </div>
  );
}
