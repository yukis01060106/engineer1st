"use client";

import { useEffect, useState, FormEvent } from "react";
import { apiFetch, ApiError } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";

interface Contract {
  id: string;
  title: string;
  body: string;
  status: string;
  signedAt: string | null;
  signedName: string | null;
  engagement: { project: { title: string; client: string } };
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [signedName, setSignedName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reload() {
    apiFetch<{ contracts: Contract[] }>("/contracts").then((res) => setContracts(res.contracts));
  }

  useEffect(reload, []);

  async function handleSign(e: FormEvent, contractId: string) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/contracts/${contractId}/sign`, {
        method: "POST",
        body: JSON.stringify({ signedName }),
      });
      setSigningId(null);
      setSignedName("");
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "締結に失敗しました");
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Contracts"
        title="契約書"
        description={<>稼働開始にあたっての業務委託契約書です。内容をご確認のうえ、電子締結してください。</>}
      />

      {contracts.length === 0 && <div className="empty-state">契約書はまだありません</div>}

      <div className="money-list">
        {contracts.map((c) => (
          <div className="money-card" key={c.id}>
            <div className="money-card-header">
              <div>
                <div className="money-card-title">{c.title}</div>
                <div className="card-sub">
                  {c.engagement.project.title}（{c.engagement.project.client}）
                </div>
              </div>
              <span className={"badge " + (c.status === "締結済み" ? "badge-success" : "badge-warning")}>
                {c.status}
              </span>
            </div>

            <p className="project-desc">{c.body}</p>

            {c.status === "締結済み" ? (
              <div className="card-sub">
                {c.signedName} が {c.signedAt && new Date(c.signedAt).toLocaleDateString("ja-JP")} に締結済み
              </div>
            ) : signingId === c.id ? (
              <form className="form-row" onSubmit={(e) => handleSign(e, c.id)}>
                <input
                  placeholder="氏名を入力して同意"
                  value={signedName}
                  onChange={(e) => setSignedName(e.target.value)}
                  required
                />
                <button className="btn-primary" type="submit">
                  同意して締結する
                </button>
                <button type="button" className="btn-secondary" onClick={() => setSigningId(null)}>
                  キャンセル
                </button>
              </form>
            ) : (
              <button className="btn-primary" onClick={() => setSigningId(c.id)}>
                内容を確認して締結する
              </button>
            )}
          </div>
        ))}
      </div>
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}
