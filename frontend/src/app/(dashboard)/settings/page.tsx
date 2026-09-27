"use client";

import { useEffect, useState, FormEvent } from "react";
import { Check } from "lucide-react";
import { apiFetch, ApiError } from "../../../api/client";
import { useAuth, WorkStyle } from "../../../context/AuthContext";
import { PageHeader } from "../../../components/PageHeader";

interface RankBenefit {
  rank: string;
  yearsLabel: string;
  benefits: string[];
}

interface ProfileData {
  user: { name: string; email: string; workStyle: WorkStyle; invoiceRegistrationNumber: string | null };
  rank: { current: string; tenureYears: number; unlockedBenefits: RankBenefit[]; allRanks: RankBenefit[] };
}

const WORK_STYLES: { value: WorkStyle; label: string }[] = [
  { value: "freelance", label: "フリーランス" },
  { value: "ses_employee", label: "SES企業の会社員" },
  { value: "considering", label: "独立を考え中" },
];

export default function SettingsPage() {
  const { refresh } = useAuth();
  const [data, setData] = useState<ProfileData | null>(null);
  const [name, setName] = useState("");
  const [workStyle, setWorkStyle] = useState<WorkStyle>("freelance");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ProfileData>("/mypage").then((res) => {
      setData(res);
      setName(res.user.name);
      setWorkStyle(res.user.workStyle);
      setRegistrationNumber(res.user.invoiceRegistrationNumber ?? "");
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetch("/mypage", {
        method: "PATCH",
        body: JSON.stringify({ name, workStyle, invoiceRegistrationNumber: registrationNumber.trim() || null }),
      });
      await refresh();
      setMessage("保存しました");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Settings" title="設定" description="働き方を変えると、メニューに表示される機能が切り替わります。" />

      <form className="panel sim-form" style={{ maxWidth: 640 }} onSubmit={handleSubmit}>
        <label>
          お名前
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          メールアドレス
          <input value={data?.user.email ?? ""} disabled />
        </label>
        <fieldset style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          <legend className="small" style={{ fontWeight: 700, color: "var(--ink-2)", marginBottom: 6 }}>
            働き方
          </legend>
          <div className="chips">
            {WORK_STYLES.map((w) => (
              <button type="button" key={w.value} className="chip" aria-pressed={workStyle === w.value} onClick={() => setWorkStyle(w.value)}>
                {w.label}
              </button>
            ))}
          </div>
        </fieldset>
        {workStyle === "freelance" && (
          <label>
            インボイス登録番号 <span className="field-hint">請求書に記載されます（例：T1234567890123）</span>
            <input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} placeholder="T1234567890123" pattern="T\d{13}" title="Tから始まる14桁" />
          </label>
        )}
        {message && (
          <div className="form-success">
            <Check size={14} /> {message}
          </div>
        )}
        {error && <div className="form-error">{error}</div>}
        <button className="btn-primary" type="submit" disabled={saving} style={{ justifySelf: "start" }}>
          {saving ? "保存中…" : "保存する"}
        </button>
      </form>

      {data && (
        <section className="panel">
          <div className="panel-head">
            <h2>会員ランクと特典</h2>
            <span className="small muted">
              いまは <strong>{data.rank.current}</strong>（在籍 {data.rank.tenureYears}年）
            </span>
          </div>
          <div className="rank-list">
            {data.rank.allRanks.map((r) => {
              const unlocked = data.rank.unlockedBenefits.some((u) => u.rank === r.rank);
              return (
                <div key={r.rank} className={"rank-item" + (unlocked ? " unlocked" : "")}>
                  <div className="rank-item-header">
                    <span className="rank-name">{r.rank}</span>
                    <span className="rank-years">{r.yearsLabel}</span>
                    {unlocked && <span className="unlocked-tag">開放済み</span>}
                  </div>
                  <ul>
                    {r.benefits.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
