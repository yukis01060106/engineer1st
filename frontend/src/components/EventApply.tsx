"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarPlus, Check, Copy, ExternalLink, MapPin } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiFetch, ApiError, downloadFile } from "../api/client";

interface Application {
  id: string;
  joinUrl: string | null;
  purpose: string | null;
}

const LEVELS = ["入門", "実務で少し", "実務でがっつり", "人に教えられる"] as const;

function googleCalendarUrl(e: { title: string; date: string; durationMin: number; location: string }, joinUrl: string | null) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(e.date);
  const end = new Date(start.getTime() + e.durationMin * 60_000);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    location: joinUrl ?? e.location,
    details: joinUrl ? `参加URL: ${joinUrl}` : "",
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

// 参加フォーム → 送信すると参加URL（オンライン）・集合場所（現地）をその場で表示する
export function EventApply({
  event,
}: {
  event: { id: string; title: string; type: string; date: string; durationMin: number; location: string; isOnline: boolean; full: boolean; clubName: string | null };
}) {
  const { user, loading } = useAuth();
  const [application, setApplication] = useState<Application | null | undefined>(undefined);
  const [purpose, setPurpose] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number] | "">("");
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ application: Application | null }>(`/events/${event.id}`)
      .then((r) => setApplication(r.application))
      .catch(() => setApplication(null));
  }, [user, event.id]);

  if (loading || (user && application === undefined)) return <div className="skeleton" style={{ height: 200 }} />;

  if (!user) {
    return (
      <div className="panel">
        <h2>参加するには</h2>
        <p className="small muted">無料の会員登録（30秒）のあと、このページに戻って参加フォームを送れます。</p>
        <Link href={`/register?event=${event.id}&next=/events/${event.id}`} className="btn-primary btn-lg">
          無料登録して申し込む <ArrowRight size={18} />
        </Link>
        <p className="small muted">
          会員の方は <Link className="btn-link" href={`/login?next=/events/${event.id}`}>ログイン</Link>
        </p>
      </div>
    );
  }

  if (application) {
    const url = application.joinUrl;
    return (
      <div className="join-box">
        <span className="badge badge-success" style={{ justifySelf: "start" }}>
          <Check size={14} /> 申込済み
        </span>
        {event.isOnline ? (
          url ? (
            <>
              <strong>参加URL</strong>
              <div className="join-url">
                <span style={{ flex: 1 }}>{url}</span>
                <button
                  className="icon-btn"
                  aria-label="参加URLをコピー"
                  onClick={() => {
                    navigator.clipboard.writeText(url).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1600);
                    });
                  }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <a className="btn-accent" href={url} target="_blank" rel="noopener noreferrer">
                参加URLを開く <ExternalLink size={16} />
              </a>
            </>
          ) : (
            <p className="small">参加URLは開催前日までにこのページとマイページでお知らせします。</p>
          )
        ) : (
          <p className="inline">
            <MapPin size={16} /> 集合場所：<strong>{event.location}</strong>
          </p>
        )}
        <div className="inline">
          <a className="btn-secondary btn-sm" href={googleCalendarUrl(event, url)} target="_blank" rel="noopener noreferrer">
            <CalendarPlus size={16} /> Googleカレンダー
          </a>
          <button className="btn-secondary btn-sm" onClick={() => downloadFile(`/events/${event.id}/calendar.ics`, `${event.title}.ics`)}>
            <CalendarPlus size={16} /> .ics をダウンロード
          </button>
        </div>
        <button
          className="btn-ghost btn-sm"
          style={{ justifySelf: "start" }}
          onClick={async () => {
            await apiFetch(`/events/${event.id}/apply`, { method: "DELETE" });
            setApplication(null);
          }}
        >
          申込を取り消す
        </button>
      </div>
    );
  }

  if (event.full) {
    return <div className="callout-inline callout-warning">定員に達したため、申込を締め切りました。</div>;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<{ application: Application }>(`/events/${event.id}/apply`, {
        method: "POST",
        body: JSON.stringify({
          purpose: purpose || undefined,
          level: level || undefined,
          question: question || undefined,
        }),
      });
      setApplication(res.application);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "申込に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2>参加フォーム</h2>
      {event.clubName && <p className="small muted">申し込むと「{event.clubName}」にも入部します。</p>}
      {event.type === "勉強会" && (
        <>
          <label>
            参加の目的 <span className="field-hint">任意</span>
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="例：現場でのAI活用を知りたい" maxLength={200} />
          </label>
          <fieldset style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            <legend className="small" style={{ fontWeight: 700, color: "var(--ink-2)", marginBottom: 6 }}>
              このテーマの経験 <span className="field-hint">任意</span>
            </legend>
            <div className="chips">
              {LEVELS.map((l) => (
                <button type="button" key={l} className="chip" aria-pressed={level === l} onClick={() => setLevel(level === l ? "" : l)}>
                  {l}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            講師への事前質問 <span className="field-hint">任意</span>
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} placeholder="当日取り上げてほしいことがあれば" />
          </label>
        </>
      )}
      {error && <div className="form-error">{error}</div>}
      <button className="btn-primary btn-lg" type="submit" disabled={submitting}>
        {submitting ? "送信中…" : event.isOnline ? "申し込んで参加URLを受け取る" : "申し込む"}
      </button>
    </form>
  );
}
