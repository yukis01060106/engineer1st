"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Check, Flame, Megaphone, Users, ChevronDown, ChevronUp } from "lucide-react";
import { apiFetch, ApiError } from "../../../api/client";
import { useAuth } from "../../../context/AuthContext";
import { PageHeader } from "../../../components/PageHeader";
import { fmtDate, fmtDateTime, man, WORK_STYLE_LABEL } from "../../../lib/format";

interface Lead {
  id: string;
  name: string;
  email: string;
  workStyle: string;
  signupSource: string | null;
  createdAt: string;
  clubs: string[];
  currentProject: { title: string; monthlyRate: number; daysLeft: number | null } | null;
  desiredRate: number | null;
  score: number;
  reasons: string[];
}

interface AdminData {
  summary: {
    totalMembers: number;
    newLast30Days: number;
    byWorkStyle: Record<string, number>;
    hotLeads: number;
    bySource: Record<string, number>;
  };
  leads: Lead[];
  clubs: { id: string; name: string; slug: string; members: number }[];
  events: { id: string; title: string; type: string; date: string; capacity: number; applications: number; club: string | null; hasJoinUrl: boolean }[];
}

interface Applicant {
  id: string;
  purpose: string | null;
  level: string | null;
  question: string | null;
  appliedAt: string;
  user: { name: string; email: string; workStyle: string };
}

const SOURCE_LABEL = (s: string) => (s === "direct" ? "直接" : s === "event" ? "イベントページ" : s.startsWith("club:") ? `部活（${s.slice(5)}）` : s);

const EMPTY_EVENT = {
  title: "",
  type: "勉強会" as "勉強会" | "部活" | "交流会",
  date: "",
  durationMin: 90,
  isOnline: true,
  location: "オンライン（Zoom）",
  joinUrl: "",
  speaker: "",
  tags: "",
  description: "",
  capacity: 100,
  clubId: "",
};

export default function AdminPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "hot" | "ses_employee" | "considering" | "freelance">("all");
  const [form, setForm] = useState(EMPTY_EVENT);
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [openEvent, setOpenEvent] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);

  function load() {
    apiFetch<AdminData>("/admin/leads").then(setData).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  if (user && user.role !== "admin") {
    return <div className="page-error">運営アカウントのみ利用できます。</div>;
  }
  if (error) return <div className="page-error">{error}</div>;
  if (!data) return <div className="page"><div className="skeleton" style={{ height: 300 }} /></div>;

  const leads = data.leads.filter((l) =>
    filter === "all" ? true : filter === "hot" ? l.score >= 50 : l.workStyle === filter
  );

  async function createEvent(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormMsg(null);
    try {
      await apiFetch("/events", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          date: new Date(form.date).toISOString(),
          joinUrl: form.joinUrl || null,
          speaker: form.speaker || null,
          clubId: form.clubId || null,
        }),
      });
      setFormMsg({ ok: true, text: "告知しました。公開ページと会員のホームに表示されます。" });
      setForm(EMPTY_EVENT);
      load();
    } catch (err) {
      setFormMsg({ ok: false, text: err instanceof ApiError ? err.message : "作成に失敗しました" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleApplicants(id: string) {
    if (openEvent === id) {
      setOpenEvent(null);
      return;
    }
    const r = await apiFetch<{ applications: Applicant[] }>(`/events/${id}/applications`);
    setApplicants(r.applications);
    setOpenEvent(id);
  }

  const s = data.summary;
  const sources = Object.entries(s.bySource).sort((a, b) => b[1] - a[1]);
  const maxSource = Math.max(1, ...sources.map(([, n]) => n));

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="見込み客と告知"
        description="部活・勉強会から登録した人を「いま案件の提案を喜んでもらえそうか」でスコア順に並べています。勉強会の告知もここから。"
      />

      <div className="stat-row">
        <div className="stat-tile" style={{ background: "#fff", border: "1px solid var(--line)" }}>
          <div className="stat-label">会員数</div>
          <div className="stat-value">{s.totalMembers}<small>人</small></div>
          <div className="stat-sub">直近30日 +{s.newLast30Days}人</div>
        </div>
        <div className="stat-tile" style={{ background: "var(--danger-soft)" }}>
          <div className="stat-label">提案どき（スコア50以上）</div>
          <div className="stat-value" style={{ color: "var(--danger)" }}>{s.hotLeads}<small>人</small></div>
        </div>
        <div className="stat-tile" style={{ background: "#fff", border: "1px solid var(--line)" }}>
          <div className="stat-label">働き方</div>
          <div className="small" style={{ marginTop: 6, lineHeight: 1.9 }}>
            フリーランス {s.byWorkStyle.freelance}人<br />
            SES会社員 {s.byWorkStyle.ses_employee}人<br />
            独立検討中 {s.byWorkStyle.considering}人
          </div>
        </div>
        <div className="stat-tile" style={{ background: "#fff", border: "1px solid var(--line)" }}>
          <div className="stat-label">流入元</div>
          <div className="stack" style={{ gap: 4, marginTop: 6 }}>
            {sources.map(([k, n]) => (
              <div key={k} className="small" style={{ display: "grid", gridTemplateColumns: "1fr 60px 20px", gap: 6, alignItems: "center" }}>
                <span>{SOURCE_LABEL(k)}</span>
                <span className="bar" style={{ height: 6 }}>
                  <span style={{ width: `${(n / maxSource) * 100}%`, background: "var(--primary)" }} />
                </span>
                <span className="num">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>
            <Flame size={18} /> 見込み客
          </h2>
          <div className="tabs">
            {([
              ["all", "すべて"],
              ["hot", "提案どき"],
              ["freelance", "フリーランス"],
              ["considering", "独立検討中"],
              ["ses_employee", "SES会社員"],
            ] as const).map(([k, l]) => (
              <button key={k} className="chip" style={{ minHeight: 32 }} aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>スコア</th>
                <th>名前</th>
                <th>働き方</th>
                <th>理由</th>
                <th>稼働・希望単価</th>
                <th>流入・登録日</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>
                    <span className={`score ${l.score >= 50 ? "score-hot" : l.score >= 30 ? "score-warm" : "score-cold"}`}>{l.score}</span>
                  </td>
                  <td>
                    <strong>{l.name}</strong>
                    <div className="small muted">{l.email}</div>
                  </td>
                  <td className="small">{WORK_STYLE_LABEL[l.workStyle]}</td>
                  <td>
                    <div className="reasons">
                      {l.reasons.map((r) => (
                        <span className="badge" key={r}>
                          {r}
                        </span>
                      ))}
                    </div>
                    {l.clubs.length > 0 && <div className="small muted" style={{ marginTop: 4 }}>部活：{l.clubs.join("・")}</div>}
                  </td>
                  <td className="small">
                    {l.currentProject ? (
                      <>
                        {man(l.currentProject.monthlyRate)}
                        {l.currentProject.daysLeft != null && <div className="muted">残り{l.currentProject.daysLeft}日</div>}
                      </>
                    ) : l.desiredRate ? (
                      `希望 ${man(l.desiredRate)}`
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="small">
                    {SOURCE_LABEL(l.signupSource ?? "direct")}
                    <div className="muted">{fmtDate(l.createdAt)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="disclaimer">※ 連絡は本人がアプリ内で希望した場合のみ。営業電話はしない方針をLP・FAQで約束しています。</p>
      </section>

      <div className="grid-main-side">
        <form className="panel" onSubmit={createEvent}>
          <div className="panel-head">
            <h2>
              <Megaphone size={18} /> 勉強会・活動を告知する
            </h2>
          </div>
          <div className="form-grid">
            <label style={{ gridColumn: "1 / -1" }}>
              タイトル
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={100} />
            </label>
            <label>
              種類
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}>
                <option>勉強会</option>
                <option>部活</option>
                <option>交流会</option>
              </select>
            </label>
            <label>
              日時
              <input type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </label>
            <label>
              時間（分）
              <input type="number" min={15} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} />
            </label>
            <label>
              定員
              <input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
            </label>
            <label>
              場所
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required />
            </label>
            <label>
              参加URL <span className="field-hint">申込者にだけ表示</span>
              <input type="url" value={form.joinUrl} onChange={(e) => setForm({ ...form, joinUrl: e.target.value })} placeholder="https://zoom.us/j/..." />
            </label>
            <label>
              講師
              <input value={form.speaker} onChange={(e) => setForm({ ...form, speaker: e.target.value })} />
            </label>
            <label>
              タグ <span className="field-hint">カンマ区切り</span>
              <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="生成AI,React" />
            </label>
            {form.type === "部活" && (
              <label>
                部活
                <select value={form.clubId} onChange={(e) => setForm({ ...form, clubId: e.target.value })} required>
                  <option value="">選択してください</option>
                  {data.clubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="checkbox-label" style={{ alignSelf: "end" }}>
              <input type="checkbox" checked={form.isOnline} onChange={(e) => setForm({ ...form, isOnline: e.target.checked })} /> オンライン開催
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              内容
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required maxLength={2000} />
            </label>
          </div>
          {formMsg && <div className={formMsg.ok ? "form-success" : "form-error"}>{formMsg.text}</div>}
          <button className="btn-primary" type="submit" disabled={saving}>
            <CalendarPlus size={16} /> {saving ? "作成中…" : "告知する"}
          </button>
        </form>

        <section className="panel">
          <div className="panel-head">
            <h2>
              <Users size={18} /> 予定と申込
            </h2>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {data.events.map((e) => (
              <div key={e.id} style={{ borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
                <button className="btn-ghost" style={{ width: "100%", justifyContent: "space-between", padding: "8px 4px", height: "auto", whiteSpace: "normal", textAlign: "left" }} onClick={() => toggleApplicants(e.id)}>
                  <span style={{ display: "grid", gap: 2 }}>
                    <span className="small muted">
                      {fmtDateTime(e.date)}・{e.type}
                      {e.club ? `・${e.club}` : ""}
                      {e.hasJoinUrl && " ・URLあり"}
                    </span>
                    <span style={{ fontSize: 13.5 }}>{e.title}</span>
                  </span>
                  <span className="inline" style={{ flexWrap: "nowrap" }}>
                    <span className="num">
                      {e.applications}/{e.capacity}
                    </span>
                    {openEvent === e.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>
                {openEvent === e.id && (
                  <div className="stack" style={{ gap: 6, padding: "4px 4px 8px" }}>
                    {applicants.length === 0 && <p className="small muted">まだ申込はありません。</p>}
                    {applicants.map((a) => (
                      <div key={a.id} className="small" style={{ background: "var(--paper)", borderRadius: 10, padding: "8px 10px" }}>
                        <strong>{a.user.name}</strong>（{WORK_STYLE_LABEL[a.user.workStyle]}）
                        {a.level && <span className="badge" style={{ marginLeft: 6 }}>{a.level}</span>}
                        {a.purpose && <div>目的：{a.purpose}</div>}
                        {a.question && <div>質問：{a.question}</div>}
                      </div>
                    ))}
                    <Link href={`/events/${e.id}`} className="btn-link small">
                      公開ページを見る
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="small muted inline" style={{ gap: 4 }}>
            <Check size={14} /> 会員には、開催14日前からホームの「やること」でお知らせします
          </p>
        </section>
      </div>
    </div>
  );
}
