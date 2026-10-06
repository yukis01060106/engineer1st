"use client";

import { useEffect, useRef, useState, FormEvent, KeyboardEvent } from "react";
import Link from "next/link";
import { Clock, Send } from "lucide-react";
import { apiFetch, ApiError } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";
import { useAuth } from "../../../context/AuthContext";
import { fmtDate } from "../../../lib/format";

interface ChatMessage {
  id: string;
  from: "user" | "staff";
  text: string;
  auto?: boolean;
  createdAt: string;
}

const SUGGESTIONS_FREELANCE = ["次の案件を探したい", "単価を上げたい", "入金が遅れている", "契約の更新について相談したい"];
const SUGGESTIONS_OTHER = ["独立について相談したい", "案件の話を聞きたい", "いまの単価が相場か知りたい", "部活について聞きたい"];

const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<{ messages: ChatMessage[] }>("/chat")
      .then((res) => setMessages(res.messages))
      .catch((e) => setError(e instanceof ApiError ? e.message : "メッセージを読み込めませんでした"));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, sending]);

  async function send(body: string) {
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    // 送った内容はすぐに表示し、返信を待つ
    const optimistic: ChatMessage = { id: "pending", from: "user", text: trimmed, createdAt: new Date().toISOString() };
    setMessages((prev) => [...(prev ?? []), optimistic]);
    setText("");
    try {
      const res = await apiFetch<{ messages: ChatMessage[] }>("/chat", { method: "POST", body: JSON.stringify({ text: trimmed }) });
      setMessages(res.messages);
    } catch (e) {
      setMessages((prev) => (prev ?? []).filter((m) => m.id !== "pending"));
      setText(trimmed);
      setError(e instanceof ApiError ? e.message : "送信できませんでした。時間をおいてお試しください");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // 日本語入力の変換確定の Enter では送らない
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(text);
    }
  }

  const suggestions = user?.workStyle === "freelance" ? SUGGESTIONS_FREELANCE : SUGGESTIONS_OTHER;
  const hasUserMessage = messages?.some((m) => m.from === "user");

  return (
    <div className="page">
      <PageHeader
        eyebrow="Support"
        title="担当者チャット"
        description={
          <>
            案件のご紹介、単価や契約の相談、請求・入金のトラブルまで、エンジニア・ガレージの担当者が受け付けます。キャリアや技術の悩みは{" "}
            <Link href="/mentor" className="btn-link">
              メンター相談
            </Link>
            もどうぞ。
          </>
        }
        actions={
          <span className="small muted inline" style={{ gap: 4 }}>
            <Clock size={14} /> 平日10〜19時・1営業日以内に返信
          </span>
        }
      />

      <div className="chat-window">
        <div className="chat-messages" aria-live="polite">
          {!messages && !error && <div className="skeleton" style={{ height: 60, width: "60%" }} />}
          {messages?.map((m, i) => {
            const day = fmtDate(m.createdAt);
            const showDay = i === 0 || fmtDate(messages[i - 1].createdAt) !== day;
            return (
              <div key={m.id + i} style={{ display: "contents" }}>
                {showDay && (
                  <div className="small muted" style={{ alignSelf: "center", fontSize: 11.5 }}>
                    {day}
                  </div>
                )}
                <div style={{ alignSelf: m.from === "user" ? "flex-end" : "flex-start", maxWidth: "82%", display: "grid", gap: 4 }}>
                  {m.from === "staff" && <span className="small muted" style={{ fontSize: 11.5 }}>{m.auto ? "エンジニア・ガレージ 受付（自動応答）" : "エンジニア・ガレージ 担当"}</span>}
                  <div className={"chat-bubble " + (m.from === "user" ? "chat-bubble-user" : "chat-bubble-staff")} style={{ maxWidth: "none" }}>
                    {m.text}
                  </div>
                  <span className="small muted" style={{ fontSize: 11, justifySelf: m.from === "user" ? "end" : "start" }}>
                    {m.id === "pending" ? "送信中…" : timeOf(m.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
          {sending && (
            <div className="chat-bubble chat-bubble-staff" aria-label="返信を待っています">
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
          {!hasUserMessage && messages && (
            <div className="chat-suggest">
              {suggestions.map((s) => (
                <button key={s} className="chip" style={{ minHeight: 32, fontSize: 12 }} onClick={() => send(s)} disabled={sending}>
                  {s}
                </button>
              ))}
            </div>
          )}
          {error && (
            <div className="form-error" role="alert" style={{ margin: "0 12px 12px" }}>
              {error}
            </div>
          )}
          <form
            className="chat-input-row"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              send(text);
            }}
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力（Shift + Enter で改行）"
              aria-label="メッセージ"
              rows={1}
              maxLength={2000}
              style={{ flex: 1, resize: "none", minHeight: 44, maxHeight: 140 }}
            />
            <button className="btn-primary" type="submit" disabled={sending || !text.trim()} aria-label="送信">
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
