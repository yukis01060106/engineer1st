"use client";

import { FormEvent, useState } from "react";
import { Building2 } from "lucide-react";
import { apiFetch, ApiError } from "../api/client";
import { todayJst } from "./TaskRow";

// いま働いている取引先を登録する。ソトバ以外で見つけた案件でも、請求書・入金チェック・契約終了のお知らせが使える
export function EngagementForm({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel?: () => void }) {
  const today = todayJst();
  const [form, setForm] = useState({
    client: "",
    title: "",
    monthlyRate: "",
    startDate: today,
    endDate: "",
    settlementMin: 140,
    settlementMax: 180,
    paymentTermDays: 30,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await apiFetch<{ engagement: { id: string } }>("/money/engagements", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          monthlyRate: Number(form.monthlyRate),
          endDate: form.endDate || null,
        }),
      });
      onCreated(r.engagement.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "登録に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit} id="engagement">
      <div className="callout-inline callout-info">
        <Building2 size={16} />
        <span>
          いま働いている取引先を登録すると、請求書づくり・入金チェック・契約終了前のお知らせが使えます。ソトバ以外で見つけた案件でもOKです（案件一覧には公開されません）。
        </span>
      </div>
      <div className="form-grid">
        <label>
          取引先（請求先）
          <input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="株式会社〇〇" required maxLength={100} />
        </label>
        <label>
          案件名
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ECサイトのリプレイス" required maxLength={100} />
        </label>
        <label>
          月単価（税抜・円）
          <input type="number" inputMode="numeric" min={10000} step={10000} value={form.monthlyRate} onChange={(e) => setForm({ ...form, monthlyRate: e.target.value })} placeholder="700000" required />
        </label>
        <label>
          稼働開始日
          <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
        </label>
        <label>
          契約終了日 <span className="field-hint">分かれば。45日前からお知らせします</span>
          <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        </label>
        <label>
          支払サイト（月末締め＋日）
          <input type="number" min={0} max={180} value={form.paymentTermDays} onChange={(e) => setForm({ ...form, paymentTermDays: Number(e.target.value) })} />
        </label>
        <label>
          精算幅 下限（h）
          <input type="number" min={0} value={form.settlementMin} onChange={(e) => setForm({ ...form, settlementMin: Number(e.target.value) })} />
        </label>
        <label>
          精算幅 上限（h）
          <input type="number" min={0} value={form.settlementMax} onChange={(e) => setForm({ ...form, settlementMax: Number(e.target.value) })} />
        </label>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="inline">
        <button className="btn-primary" type="submit" disabled={saving}>
          {saving ? "登録中…" : "取引先を登録する"}
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            キャンセル
          </button>
        )}
      </div>
    </form>
  );
}
