"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { apiFetch } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";

interface ChatMessage {
  id: string;
  from: "user" | "staff";
  text: string;
  createdAt: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<{ messages: ChatMessage[] }>("/chat").then((res) => setMessages(res.messages));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await apiFetch<{ messages: ChatMessage[] }>("/chat", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setMessages(res.messages);
      setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Support" title="担当者チャット" />
      <div className="chat-window">
        <div className="chat-messages">
          {messages.map((m) => (
            <div key={m.id} className={"chat-bubble " + (m.from === "user" ? "chat-bubble-user" : "chat-bubble-staff")}>
              {m.text}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <form className="chat-input-row" onSubmit={handleSubmit}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="メッセージを入力..."
          />
          <button className="btn-primary" type="submit" disabled={sending}>
            送信
          </button>
        </form>
      </div>
    </div>
  );
}
