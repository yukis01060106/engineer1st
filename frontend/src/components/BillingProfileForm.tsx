"use client";

import { FormEvent, useState } from "react";
import { Check, Landmark } from "lucide-react";
import type { BillingProfile } from "@shared/invoice";
import { apiFetch, ApiError } from "../api/client";

const EMPTY_BANK = { bankName: "", branchName: "", accountType: "普通", accountNumber: "", accountHolder: "" };

// 全角カナ・英数・記号を、口座名義でよく使う全角カナ（スペースは半角）へそろえる
const toKana = (s: string) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)).replace(/　/g, " ");

// 請求書に載せる発行者情報（屋号・住所・連絡先・振込先）。保存後に発行する請求書から反映される
export function BillingProfileForm({ initial }: { initial: BillingProfile }) {
  const [p, setP] = useState({
    businessName: initial.businessName ?? "",
    postalCode: initial.postalCode ?? "",
    address: initial.address ?? "",
    phone: initial.phone ?? "",
  });
  const [bank, setBank] = useState({ ...EMPTY_BANK, ...(initial.bank ?? {}) });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const bankFilled = Object.entries(bank).some(([k, v]) => k !== "accountType" && v.trim());

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await apiFetch("/mypage", {
        method: "PATCH",
        body: JSON.stringify({
          billingProfile: {
            businessName: p.businessName.trim(),
            postalCode: p.postalCode.trim(),
            address: p.address.trim(),
            phone: p.phone.trim(),
            bank: bankFilled ? { ...bank, accountHolder: toKana(bank.accountHolder.trim()) } : null,
          },
        }),
      });
      setMsg({ ok: true, text: "保存しました。これから発行する請求書に反映されます（発行済みの請求書は変わりません）" });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "保存できませんでした" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel stack" style={{ maxWidth: 640, scrollMarginTop: 80 }} id="billing" onSubmit={submit}>
      <div className="panel-head">
        <h2>
          <Landmark size={18} /> 請求書に載せる情報
        </h2>
      </div>
      <div className="form-grid">
        <label>
          屋号 <span className="field-hint">任意</span>
          <input value={p.businessName} onChange={(e) => setP({ ...p, businessName: e.target.value })} placeholder="例：アオキ開発" maxLength={60} />
        </label>
        <label>
          電話番号 <span className="field-hint">任意</span>
          <input value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} placeholder="090-0000-0000" inputMode="tel" maxLength={15} />
        </label>
        <label>
          郵便番号
          <input value={p.postalCode} onChange={(e) => setP({ ...p, postalCode: e.target.value })} placeholder="150-0000" inputMode="numeric" maxLength={8} />
        </label>
      </div>
      <label>
        住所 <span className="field-hint">請求書の発行者欄に載ります</span>
        <input value={p.address} onChange={(e) => setP({ ...p, address: e.target.value })} placeholder="東京都渋谷区〇〇 1-2-3" maxLength={120} />
      </label>

      <strong className="small" style={{ marginTop: 4 }}>振込先の口座</strong>
      <div className="form-grid">
        <label>
          銀行名
          <input value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })} placeholder="〇〇銀行" maxLength={40} required={bankFilled} />
        </label>
        <label>
          支店名
          <input value={bank.branchName} onChange={(e) => setBank({ ...bank, branchName: e.target.value })} placeholder="渋谷支店" maxLength={40} required={bankFilled} />
        </label>
        <label>
          種別
          <select value={bank.accountType} onChange={(e) => setBank({ ...bank, accountType: e.target.value })}>
            <option>普通</option>
            <option>当座</option>
          </select>
        </label>
        <label>
          口座番号 <span className="field-hint">7桁</span>
          <input
            value={bank.accountNumber}
            onChange={(e) => setBank({ ...bank, accountNumber: e.target.value.replace(/\D/g, "").slice(0, 7) })}
            inputMode="numeric"
            pattern="\d{7}"
            title="7桁の数字"
            placeholder="1234567"
            required={bankFilled}
          />
        </label>
      </div>
      <label>
        口座名義（カナ）
        <input value={bank.accountHolder} onChange={(e) => setBank({ ...bank, accountHolder: e.target.value })} onBlur={() => setBank({ ...bank, accountHolder: toKana(bank.accountHolder) })} placeholder="アオキ ヤクモ" maxLength={60} required={bankFilled} />
      </label>
      {msg && (
        <div className={msg.ok ? "form-success" : "form-error"} role="status">
          {msg.ok && <Check size={14} />} {msg.text}
        </div>
      )}
      <button className="btn-primary" type="submit" disabled={saving} style={{ justifySelf: "start" }}>
        {saving ? "保存中…" : "保存する"}
      </button>
    </form>
  );
}
