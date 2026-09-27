"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { Inbox, MessageCircleQuestion, MessagesSquare, Send } from "lucide-react";
import { apiFetch, ApiError } from "../api/client";
import { fmtDateTime } from "../lib/format";

interface MentorItem {
  id: string;
  topic: string;
  message: string;
  status: string;
  createdAt: string;
  user: { name: string; email: string };
}

interface ChatSummary {
  userId: string;
  name: string;
  email: string;
  lastText: string;
  lastAt: string;
  waiting: boolean;
  count: number;
}

interface ChatMessage {
  id: string;
  from: "user" | "staff";
  text: string;
  auto: boolean;
  createdAt: string;
}

const STATUSES = ["受付中", "対応中", "完了"];
const STATUS_BADGE: Record<string, string> = { 受付中: "badge-warning", 対応中: "badge-violet", 完了: "badge-success" };

// 運営画面: 会員からのメンター相談と、担当者の返信を待っているチャット
export function AdminInbox() {
  const [tab, setTab] = useState<"chat" | "mentor">("chat");
  const [mentor, setMentor] = useState<MentorItem[] | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [openUser, setOpenUser] = useState<ChatSummary | null>(null);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function load() {
    apiFetch<{ mentor: MentorItem[]; chats: ChatSummary[] }>("/admin/inbox")
      .then((r) => {
        setMentor(r.mentor);
        setChats(r.chats);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "読み込めませんでした"));
  }
  useEffect(load, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [thread]);

  async function openThread(c: ChatSummary) {
    setOpenUser(c);
    setReply("");
    setError(null);
    try {
      const r = await apiFetch<{ messages: ChatMessage[] }>(`/admin/chat/${c.userId}`);
      setThread(r.messages);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "読み込めませんでした");
    }
  }

  async function sendReply(e: FormEvent) {
    e.preventDefault();
    if (!openUser || !reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      const r = await apiFetch<{ messages: ChatMessage[] }>(`/admin/chat/${openUser.userId}`, { method: "POST", body: JSON.stringify({ text: reply }) });
      setThread(r.messages);
      setReply("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "送信できませんでした");
    } finally {
      setSending(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setMentor((prev) => prev?.map((m) => (m.id === id ? { ...m, status } : m)) ?? null);
    try {
      await apiFetch(`/admin/mentor/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    } catch {
      load();
    }
  }

  const waitingChats = chats.filter((c) => c.waiting).length;
  const openMentor = mentor?.filter((m) => m.status === "受付中").length ?? 0;

  return (
    <section className="panel stack">
      <div className="panel-head">
        <h2>
          <Inbox size={18} /> 相談・問い合わせ
        </h2>
        <div className="chips" role="group" aria-label="表示の切り替え">
          <button className="chip" aria-pressed={tab === "chat"} onClick={() => setTab("chat")}>
            <MessagesSquare size={14} /> チャット{waitingChats > 0 && <span className="badge badge-danger">{waitingChats}</span>}
          </button>
          <button className="chip" aria-pressed={tab === "mentor"} onClick={() => setTab("mentor")}>
            <MessageCircleQuestion size={14} /> メンター相談{openMentor > 0 && <span className="badge badge-warning">{openMentor}</span>}
          </button>
        </div>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      {!mentor && !error && <div className="skeleton" style={{ height: 120 }} />}

      {mentor && tab === "chat" && (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div>
            {chats.length === 0 && <div className="empty-state">まだ問い合わせはありません</div>}
            <ul className="plan-list" style={{ marginTop: 0 }}>
              {chats.map((c) => (
                <li key={c.userId} style={{ cursor: "pointer", background: openUser?.userId === c.userId ? "var(--paper)" : undefined, paddingInline: 8, borderRadius: 8 }} onClick={() => openThread(c)}>
                  <span className="plan-title">
                    <strong className="small">{c.name}</strong> {c.waiting && <span className="badge badge-danger">返信待ち</span>}
                    <span className="small muted" style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.lastText}
                    </span>
                  </span>
                  <span className="small muted num" style={{ flex: "none" }}>{fmtDateTime(c.lastAt)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            {!openUser ? (
              <p className="small muted">左の一覧から会員を選ぶと、やりとりが表示されます。「返信待ち」は、受付の自動応答だけで担当者がまだ返していないものです。</p>
            ) : (
              <div className="chat-window" style={{ height: 420, minHeight: 0 }}>
                <div className="chat-messages">
                  {thread.map((m) => (
                    <div key={m.id} className={"chat-bubble " + (m.from === "user" ? "chat-bubble-staff" : "chat-bubble-user")} style={m.auto ? { opacity: 0.55 } : undefined}>
                      {m.auto && <span className="small" style={{ display: "block", opacity: 0.8 }}>自動応答</span>}
                      {m.text}
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
                <form className="chat-input-row" onSubmit={sendReply}>
                  <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`${openUser.name}さんへ返信`} aria-label="返信" maxLength={2000} />
                  <button className="btn-primary" type="submit" disabled={sending || !reply.trim()} aria-label="送信">
                    <Send size={16} />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {mentor && tab === "mentor" && (
        <div className="stack">
          {mentor.length === 0 && <div className="empty-state">まだ相談はありません</div>}
          {mentor.map((m) => (
            <div key={m.id} className="card stack" style={{ gap: 8, padding: 16 }}>
              <div className="spread">
                <div>
                  <strong>{m.topic}</strong>
                  <div className="small muted">
                    {m.user.name}（{m.user.email}）・{fmtDateTime(m.createdAt)}
                  </div>
                </div>
                <div className="inline" style={{ gap: 6 }}>
                  <span className={"badge " + (STATUS_BADGE[m.status] ?? "")}>{m.status}</span>
                  <select value={m.status} onChange={(e) => setStatus(m.id, e.target.value)} aria-label="状態を変える" style={{ width: "auto", minHeight: 34, padding: "4px 10px" }}>
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="project-desc">{m.message}</p>
            </div>
          ))}
          <p className="disclaimer">候補日はメールで送り、送ったら「対応中」、相談が終わったら「完了」にしてください。会員の画面にも状態が表示されます。</p>
        </div>
      )}
    </section>
  );
}
