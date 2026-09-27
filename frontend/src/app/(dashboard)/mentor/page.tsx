"use client";

import { useEffect, useState, FormEvent } from "react";
import { apiFetch } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";

interface MentorRequest {
  id: string;
  topic: string;
  message: string;
  status: string;
  createdAt: string;
}

export default function MentorPage() {
  const [requests, setRequests] = useState<MentorRequest[]>([]);
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reload() {
    apiFetch<{ requests: MentorRequest[] }>("/mentor").then((res) => setRequests(res.requests));
  }

  useEffect(reload, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/mentor", { method: "POST", body: JSON.stringify({ topic, message }) });
      setTopic("");
      setMessage("");
      reload();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Mentor"
        title="メンター相談"
        description={<>キャリアや技術のお悩みをメンターに相談できます。</>}
      />

      <form className="section sim-form" onSubmit={handleSubmit}>
        <label>
          相談テーマ
          <input value={topic} onChange={(e) => setTopic(e.target.value)} required />
        </label>
        <label>
          相談内容
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} required />
        </label>
        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? "送信中..." : "相談する"}
        </button>
      </form>

      <section className="section">
        <h2>相談履歴</h2>
        {requests.length === 0 && <div className="empty-state">相談履歴はありません</div>}
        <div className="money-list">
          {requests.map((r) => (
            <div className="money-card" key={r.id}>
              <div className="money-card-header">
                <div className="money-card-title">{r.topic}</div>
                <span className="badge badge-warning">{r.status}</span>
              </div>
              <p className="project-desc">{r.message}</p>
              <div className="card-sub">{new Date(r.createdAt).toLocaleString("ja-JP")}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
