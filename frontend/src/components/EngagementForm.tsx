"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, Building2 } from "lucide-react";
import { calcSettlement, FREELANCE_ACT_MAX_DAYS, type SettlementMethod } from "@shared/invoice";
import { apiFetch, ApiError } from "../api/client";
import { todayJst } from "./TaskRow";

export interface SettlementTermsValue {
  settlementMethod: SettlementMethod;
  settlementMin: number;
  settlementMax: number;
  unitRounding: number;
  hoursUnitMinutes: number;
  paymentTermDays: number;
}

const METHOD_OPTIONS: { value: SettlementMethod; label: string; hint: string }[] = [
  { value: "updown", label: "上下割", hint: "控除は 月額÷下限、超過は 月額÷上限 で時間単価を出す（いちばん多い）" },
  { value: "middle", label: "中間割", hint: "超過も控除も 月額÷中間の時間 で同じ時間単価" },
  { value: "fixed", label: "精算なし", hint: "稼働時間にかかわらず月額固定" },
];

// 契約書の「精算条件」の欄をそのまま写せるように、よくある条件を選べるようにする
export function SettlementFields({ value, onChange, monthlyRate }: { value: SettlementTermsValue; onChange: (v: SettlementTermsValue) => void; monthlyRate?: number }) {
  const set = (patch: Partial<SettlementTermsValue>) => onChange({ ...value, ...patch });
  const method = METHOD_OPTIONS.find((m) => m.value === value.settlementMethod) ?? METHOD_OPTIONS[0];
  // 条件の確認用に、下限・上限を1時間外れたときの単価を見せる
  const sample =
    monthlyRate && value.settlementMethod !== "fixed" && value.settlementMin <= value.settlementMax
      ? {
          under: calcSettlement({ ...value, monthlyRate, workHours: value.settlementMin - 1 }).hourlyUnit,
          over: calcSettlement({ ...value, monthlyRate, workHours: value.settlementMax + 1 }).hourlyUnit,
        }
      : null;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <fieldset style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
        <legend className="small" style={{ fontWeight: 700, color: "var(--ink-2)", marginBottom: 6 }}>
          精算方法
        </legend>
        <div className="chips">
          {METHOD_OPTIONS.map((m) => (
            <button type="button" key={m.value} className="chip" aria-pressed={value.settlementMethod === m.value} onClick={() => set({ settlementMethod: m.value })}>
              {m.label}
            </button>
          ))}
        </div>
        <span className="field-hint">{method.hint}</span>
      </fieldset>
      <div className="form-grid">
        {value.settlementMethod !== "fixed" && (
          <>
            <label>
              精算幅 下限（h）
              <input type="number" min={0} max={400} value={value.settlementMin} onChange={(e) => set({ settlementMin: Number(e.target.value) })} />
            </label>
            <label>
              精算幅 上限（h）
              <input type="number" min={0} max={400} value={value.settlementMax} onChange={(e) => set({ settlementMax: Number(e.target.value) })} />
            </label>
            <label>
              時間単価の端数
              <select value={value.unitRounding} onChange={(e) => set({ unitRounding: Number(e.target.value) })}>
                <option value={1}>1円未満切り捨て</option>
                <option value={10}>10円未満切り捨て</option>
                <option value={100}>100円未満切り捨て</option>
              </select>
            </label>
            <label>
              稼働時間の単位
              <select value={value.hoursUnitMinutes} onChange={(e) => set({ hoursUnitMinutes: Number(e.target.value) })}>
                <option value={1}>そのまま（1分単位）</option>
                <option value={15}>15分単位（切り捨て）</option>
                <option value={30}>30分単位（切り捨て）</option>
                <option value={60}>1時間単位（切り捨て）</option>
              </select>
            </label>
          </>
        )}
        <label>
          支払サイト（月末締め＋日）
          <input type="number" min={0} max={180} value={value.paymentTermDays} onChange={(e) => set({ paymentTermDays: Number(e.target.value) })} />
        </label>
      </div>
      {value.settlementMin > value.settlementMax && value.settlementMethod !== "fixed" && (
        <span className="small" style={{ color: "var(--danger)" }}>精算幅は「下限 ≦ 上限」で入力してください</span>
      )}
      {sample && (
        <span className="small muted">
          この条件だと、控除単価 {sample.under.toLocaleString()}円／時・超過単価 {sample.over.toLocaleString()}円／時 です。
        </span>
      )}
      {value.paymentTermDays > FREELANCE_ACT_MAX_DAYS && (
        <div className="callout-inline callout-warning">
          <AlertTriangle size={16} />
          <span>支払サイトが60日を超えています。フリーランス法では、給付の受領から60日以内に支払期日を定める必要があります。</span>
        </div>
      )}
    </div>
  );
}

// いま働いている取引先を登録する。ソトバ以外で見つけた案件でも、請求書・入金チェック・契約終了のお知らせが使える
export function EngagementForm({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel?: () => void }) {
  const today = todayJst();
  const [form, setForm] = useState({
    client: "",
    billingName: "",
    title: "",
    monthlyRate: "",
    startDate: today,
    endDate: "",
  });
  const [terms, setTerms] = useState<SettlementTermsValue>({
    settlementMethod: "updown",
    settlementMin: 140,
    settlementMax: 180,
    unitRounding: 1,
    hoursUnitMinutes: 1,
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
          ...terms,
          billingName: form.billingName.trim() || null,
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
          いま働いている取引先を登録すると、請求書づくり・入金チェック・契約終了前のお知らせが使えます。ソトバ以外で見つけた案件でもOKです（案件一覧には公開されません）。契約書の「報酬・精算条件」の欄を見ながら入れてください。
        </span>
      </div>
      <div className="form-grid">
        <label>
          取引先（請求先）
          <input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="株式会社〇〇" required maxLength={100} />
        </label>
        <label>
          請求書の宛名 <span className="field-hint">部署名まで書く場合など。空欄なら取引先名</span>
          <input value={form.billingName} onChange={(e) => setForm({ ...form, billingName: e.target.value })} placeholder="株式会社〇〇 経理部" maxLength={100} />
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
      </div>
      <SettlementFields value={terms} onChange={setTerms} monthlyRate={Number(form.monthlyRate) || undefined} />
      {error && <div className="form-error">{error}</div>}
      <div className="inline">
        <button className="btn-primary" type="submit" disabled={saving || (terms.settlementMethod !== "fixed" && terms.settlementMin > terms.settlementMax)}>
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
