"use client";

import { useEffect, useState, FormEvent } from "react";
import { Check, Clock, MessageCircleQuestion, Send, Video } from "lucide-react";
import { apiFetch, ApiError } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";
import { useAuth } from "../../../context/AuthContext";
import { fmtDateTime } from "../../../lib/format";

interface MentorRequest {
  id: string;
  topic: string;
  message: string;
  status: string;
  createdAt: string;
}

const THEMES: { label: string; hint: string }[] = [
  { label: "独立・フリーランスの始め方", hint: "例：いまSESで3年目。独立するならいつ・何から準備すればいいか知りたいです。" },
  { label: "単価・案件の選び方", hint: "例：いまの単価が相場より低い気がします。次の更新で上げたいのですが、どう切り出せばいいですか。" },
  { label: "技術・学び方", hint: "例：フロントエンドからバックエンドにも広げたいです。何から学ぶと案件につながりますか。" },
  { label: "キャリアの方向性", hint: "例：PM寄りに進むか、スペシャリストを目指すか迷っています。" },
  { label: "働き方・体調", hint: "例：リモートで運動不足と孤独感があります。先輩はどう工夫していますか。" },
  { label: "その他", hint: "どんなことでも大丈夫です。" },
];

const STATUS_STEPS = ["受付中", "対応中", "完了"];
const STATUS_BADGE: Record<string, string> = { 受付中: "badge-warning", 対応中: "badge-violet", 完了: "badge-success" };
const STATUS_NOTE: Record<string, string> = {
  受付中: "メンターを調整しています。2営業日以内に候補日をメールでお送りします。",
  対応中: "候補日をお送りしました。メールをご確認ください。",
  完了: "相談は完了しました。また気軽にどうぞ。",
};

export default function MentorPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MentorRequest[] | null>(null);
  const [theme, setTheme] = useState(THEMES[0].label);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    apiFetch<{ requests: MentorRequest[] }>("/mentor")
      .then((res) => setRequests(res.requests))
      .catch((e) => setError(e instanceof ApiError ? e.message : "相談履歴を読み込めませんでした"));
  }

  useEffect(reload, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/mentor", { method: "POST", body: JSON.stringify({ topic: theme, message }) });
      setMessage("");
      setSent(true);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "送信できませんでした。時間をおいてお試しください");
    } finally {
      setSubmitting(false);
    }
  }

  const hint = THEMES.find((t) => t.label === theme)?.hint ?? "";
  const open = requests?.filter((r) => r.status !== "完了").length ?? 0;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Mentor"
        title="メンター相談"
        description={<>フリーランス歴の長い先輩エンジニアに、オンラインで30分、無料で相談できます。社内に聞ける人がいない悩みを、気軽にどうぞ。</>}
      />

      <ol className="steps" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {[
          { icon: Send, title: "相談を送る", body: "テーマと、いま困っていることを書いて送ります。" },
          { icon: Clock, title: "メンターを調整", body: "内容に合うメンターを選び、2営業日以内に候補日をメールでお送りします。" },
          { icon: Video, title: "オンラインで30分", body: "ビデオ通話で話します。カメラはオフでも大丈夫です。" },
        ].map((s) => (
          <li key={s.title} className="step" style={{ padding: 20 }}>
            <strong className="inline" style={{ gap: 6 }}>
              <s.icon size={16} /> {s.title}
            </strong>
            <span className="small muted">{s.body}</span>
          </li>
        ))}
      </ol>

      <div className="grid-main-side">
        <form className="panel stack" onSubmit={handleSubmit}>
          <div className="panel-head">
            <h2>
              <MessageCircleQuestion size={18} /> 相談を送る
            </h2>
          </div>
          <fieldset style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            <legend className="small" style={{ fontWeight: 700, color: "var(--ink-2)", marginBottom: 6 }}>
              相談したいテーマ
            </legend>
            <div className="chips">
              {THEMES.map((t) => (
                <button type="button" key={t.label} className="chip" aria-pressed={theme === t.label} onClick={() => setTheme(t.label)}>
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            相談したいこと <span className="field-hint">{message.length} / 2000文字</span>
            <textarea value={message} onChange={(e) => { setMessage(e.target.value); setSent(false); }} placeholder={hint} rows={6} maxLength={2000} required />
          </label>
          <p className="small muted">
            返信は登録メールアドレス（{user?.email}）にお送りします。書いた内容はメンターと運営だけが見ます。
          </p>
          {sent && (
            <div className="form-success inline" role="status" style={{ gap: 6 }}>
              <Check size={14} /> 受け付けました。2営業日以内に候補日をお送りします。
            </div>
          )}
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="btn-primary" type="submit" disabled={submitting || !message.trim()} style={{ justifySelf: "start" }}>
            <Send size={16} /> {submitting ? "送信中…" : "この内容で相談する"}
          </button>
        </form>

        <section className="panel">
          <div className="panel-head">
            <h2>相談の履歴</h2>
            {open > 0 && <span className="badge badge-warning">進行中 {open}件</span>}
          </div>
          {!requests && !error && <div className="skeleton" style={{ height: 120 }} />}
          {requests && requests.length === 0 && <div className="empty-state">まだ相談はありません。最初の一歩に、気になっていることをひとつ書いてみてください。</div>}
          <div className="stack">
            {requests?.map((r) => {
              const stepIdx = Math.max(0, STATUS_STEPS.indexOf(r.status));
              return (
                <details key={r.id} className="money-card card" style={{ padding: 16 }}>
                  <summary style={{ cursor: "pointer", listStyle: "none" }}>
                    <div className="money-card-header">
                      <div>
                        <div className="money-card-title">{r.topic}</div>
                        <div className="card-sub">{fmtDateTime(r.createdAt)}</div>
                      </div>
                      <span className={"badge " + (STATUS_BADGE[r.status] ?? "")}>{r.status}</span>
                    </div>
                  </summary>
                  <div className="bar" style={{ marginTop: 10 }} aria-label={`進み具合: ${r.status}`}>
                    <span style={{ width: `${((stepIdx + 1) / STATUS_STEPS.length) * 100}%`, background: "var(--primary)" }} />
                  </div>
                  <p className="small muted">{STATUS_NOTE[r.status]}</p>
                  <p className="project-desc">{r.message}</p>
                </details>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
