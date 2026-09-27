"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, Download, FilePlus2, Landmark, Mail, Receipt, Settings2, Info } from "lucide-react";
import { apiFetch, ApiError, downloadFile } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";
import { yen, man, pct, fmtDate } from "../../../lib/format";

interface Engagement {
  id: string;
  monthlyRate: number;
  status: string;
  settlementMin: number;
  settlementMax: number;
  paymentTermDays: number;
  paymentTermWarning: boolean;
  project: { title: string; client: string };
}

interface Invoice {
  id: string;
  targetMonth: string;
  amount: number;
  baseAmount: number;
  workHours: number | null;
  adjustment: number;
  withholding: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  invoiceNumber: string;
  dueDate: string | null;
  paidAt: string | null;
  state: "paid" | "unpaid" | "overdue";
  engagement: { project: { title: string; client: string } };
}

interface Preview {
  amount: number;
  taxAmount: number;
  totalAmount: number;
  baseAmount: number;
  adjustment: number;
  settlementNote: string;
  withholding: number;
  transferAmount: number;
  dueDate: string;
}

interface TaxReserve {
  annualRevenue: number;
  items: { key: string; label: string; annual: number; when: string }[];
  totalAnnual: number;
  reserveRate: number;
  monthlyReserve: number;
  consumptionTaxLabel: string;
}

const STATE_BADGE = {
  paid: { cls: "badge-success", label: "入金済み" },
  unpaid: { cls: "badge", label: "入金待ち" },
  overdue: { cls: "badge-danger", label: "期日超過" },
};

const RESERVE_COLORS: Record<string, string> = {
  income: "var(--ink)",
  resident: "var(--primary)",
  business: "var(--violet)",
  nhi: "var(--mint)",
  pension: "var(--pink)",
  consumption: "var(--yellow)",
};

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function MoneyPage() {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<{ outstandingAmount: number; overdueCount: number; paidThisYear: number } | null>(null);

  const [engagementId, setEngagementId] = useState("");
  const [targetMonth, setTargetMonth] = useState(thisMonth);
  const [workHours, setWorkHours] = useState("");
  const [withholding, setWithholding] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issued, setIssued] = useState<string | null>(null);

  const [editTerms, setEditTerms] = useState(false);
  const [terms, setTerms] = useState({ settlementMin: 140, settlementMax: 180, paymentTermDays: 30 });

  const [reminder, setReminder] = useState<{ id: string; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [reserve, setReserve] = useState<TaxReserve | null>(null);
  const [expenseRatio, setExpenseRatio] = useState(20);
  const [blue, setBlue] = useState(true);
  const [invoiceRegistered, setInvoiceRegistered] = useState(true);

  const reload = useCallback(() => {
    apiFetch<{ invoices: Invoice[]; summary: typeof summary }>("/money/invoices").then((r) => {
      setInvoices(r.invoices);
      setSummary(r.summary);
    });
    apiFetch<{ engagements: Engagement[] }>("/money/engagements").then((r) => {
      setEngagements(r.engagements);
      setEngagementId((prev) => prev || r.engagements.find((e) => e.status === "稼働中")?.id || r.engagements[0]?.id || "");
    });
  }, []);

  useEffect(reload, [reload]);

  const engagement = engagements.find((e) => e.id === engagementId) ?? null;

  // 入力のたびに精算をプレビュー（少し待ってから）
  useEffect(() => {
    if (!engagementId) return;
    const t = setTimeout(() => {
      apiFetch<{ preview: Preview }>("/money/invoices/preview", {
        method: "POST",
        body: JSON.stringify({
          engagementId,
          targetMonth,
          workHours: workHours === "" ? null : Number(workHours),
          applyWithholding: withholding,
        }),
      })
        .then((r) => setPreview(r.preview))
        .catch(() => setPreview(null));
    }, 250);
    return () => clearTimeout(t);
  }, [engagementId, targetMonth, workHours, withholding, engagements]);

  useEffect(() => {
    const q = new URLSearchParams({ expenseRatio: String(expenseRatio / 100), blue: String(blue), invoice: String(invoiceRegistered) });
    apiFetch<{ result: TaxReserve }>(`/money/tax-reserve?${q}`).then((r) => setReserve(r.result));
  }, [expenseRatio, blue, invoiceRegistered]);

  async function issue() {
    setIssuing(true);
    setIssueError(null);
    setIssued(null);
    try {
      const r = await apiFetch<{ invoice: { invoiceNumber: string } }>("/money/invoices", {
        method: "POST",
        body: JSON.stringify({
          engagementId,
          targetMonth,
          workHours: workHours === "" ? null : Number(workHours),
          applyWithholding: withholding,
        }),
      });
      setIssued(r.invoice.invoiceNumber);
      setWorkHours("");
      reload();
    } catch (e) {
      setIssueError(e instanceof ApiError ? e.message : "発行に失敗しました");
    } finally {
      setIssuing(false);
    }
  }

  async function saveTerms() {
    try {
      await apiFetch(`/money/engagements/${engagementId}`, { method: "PATCH", body: JSON.stringify(terms) });
      setEditTerms(false);
      reload();
    } catch (e) {
      setIssueError(e instanceof ApiError ? e.message : "保存に失敗しました");
    }
  }

  async function togglePaid(inv: Invoice) {
    await apiFetch(`/money/invoices/${inv.id}/paid`, { method: "POST", body: JSON.stringify({ paid: inv.state !== "paid" }) });
    reload();
  }

  async function showReminder(inv: Invoice) {
    const r = await apiFetch<{ text: string }>(`/money/invoices/${inv.id}/reminder`);
    setReminder({ id: inv.id, text: r.text });
    setCopied(false);
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Money"
        title="請求・入金・税金"
        description="稼働時間を入れるだけで、精算幅・インボイス・源泉徴収まで計算した請求書をつくります。入金まで見守り、税金の取り分けも一緒に。"
      />

      {summary && (
        <div className="stat-row">
          <div className="stat-tile" style={{ background: "#fff", border: "1px solid var(--line)" }}>
            <div className="stat-label">未入金（振込予定額）</div>
            <div className="stat-value">{man(summary.outstandingAmount).replace("万円", "")}<small>万円</small></div>
          </div>
          <div className="stat-tile" style={summary.overdueCount ? { background: "var(--danger-soft)" } : { background: "#fff", border: "1px solid var(--line)" }}>
            <div className="stat-label">支払期日を過ぎた請求</div>
            <div className="stat-value" style={summary.overdueCount ? { color: "var(--danger)" } : undefined}>{summary.overdueCount}<small>件</small></div>
          </div>
          <div className="stat-tile" style={{ background: "#fff", border: "1px solid var(--line)" }}>
            <div className="stat-label">今年の入金（税抜）</div>
            <div className="stat-value">{man(summary.paidThisYear).replace("万円", "")}<small>万円</small></div>
          </div>
        </div>
      )}

      <div className="grid-main-side">
        {/* 請求書をつくる */}
        <section className="panel">
          <div className="panel-head">
            <h2>
              <FilePlus2 size={18} /> 請求書をつくる
            </h2>
          </div>
          {engagements.length === 0 ? (
            <div className="empty-state">稼働中の案件がありません</div>
          ) : (
            <>
              <div className="form-grid">
                <label>
                  請求先
                  <select value={engagementId} onChange={(e) => setEngagementId(e.target.value)}>
                    {engagements.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.project.client}（{e.project.title}）{e.status === "稼働中" ? "" : "・終了"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  対象月
                  <input type="month" value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} />
                </label>
                <label>
                  稼働時間 <span className="field-hint">空欄なら月額固定</span>
                  <input type="number" inputMode="decimal" step="0.25" min={0} value={workHours} onChange={(e) => setWorkHours(e.target.value)} placeholder="例：162.5" />
                </label>
              </div>

              {engagement && (
                <div className="callout-inline callout-info">
                  <Settings2 size={16} />
                  <div style={{ flex: 1 }}>
                    {editTerms ? (
                      <div className="stack" style={{ gap: 10 }}>
                        <div className="form-grid">
                          <label>
                            精算幅 下限（h）
                            <input type="number" value={terms.settlementMin} onChange={(e) => setTerms({ ...terms, settlementMin: Number(e.target.value) })} />
                          </label>
                          <label>
                            精算幅 上限（h）
                            <input type="number" value={terms.settlementMax} onChange={(e) => setTerms({ ...terms, settlementMax: Number(e.target.value) })} />
                          </label>
                          <label>
                            支払サイト（月末締め＋日）
                            <input type="number" value={terms.paymentTermDays} onChange={(e) => setTerms({ ...terms, paymentTermDays: Number(e.target.value) })} />
                          </label>
                        </div>
                        <div className="inline">
                          <button className="btn-primary btn-sm" onClick={saveTerms}>保存</button>
                          <button className="btn-ghost btn-sm" onClick={() => setEditTerms(false)}>キャンセル</button>
                        </div>
                      </div>
                    ) : (
                      <div className="spread">
                        <span>
                          月額 <strong className="num">{yen(engagement.monthlyRate)}</strong>／精算幅 {engagement.settlementMin}〜{engagement.settlementMax}h／月末締め{engagement.paymentTermDays}日後払い
                        </span>
                        <button
                          className="btn-link small"
                          onClick={() => {
                            setTerms({ settlementMin: engagement.settlementMin, settlementMax: engagement.settlementMax, paymentTermDays: engagement.paymentTermDays });
                            setEditTerms(true);
                          }}
                        >
                          契約条件を編集
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {engagement?.paymentTermWarning && (
                <div className="callout-inline callout-warning">
                  <AlertTriangle size={16} />
                  支払サイトが60日を超えています。フリーランス法では、給付の受領から60日以内に支払期日を定める必要があります。
                </div>
              )}

              <label className="checkbox-label">
                <input type="checkbox" checked={withholding} onChange={(e) => setWithholding(e.target.checked)} />
                源泉徴収する（デザイン・原稿など対象業務を含む場合のみ。システム開発は通常不要）
              </label>

              {preview && (
                <table className="invoice-table">
                  <tbody>
                    <tr>
                      <td>月額（精算前）</td>
                      <td>{yen(preview.baseAmount)}</td>
                    </tr>
                    {preview.adjustment !== 0 && (
                      <tr>
                        <td>
                          {preview.adjustment > 0 ? "超過精算" : "控除精算"}
                          <div className="small muted">{preview.settlementNote}</div>
                        </td>
                        <td style={{ color: preview.adjustment < 0 ? "var(--danger)" : "var(--success)" }}>
                          {preview.adjustment > 0 ? "+" : "−"}
                          {yen(Math.abs(preview.adjustment))}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td>消費税（10%）</td>
                      <td>{yen(preview.taxAmount)}</td>
                    </tr>
                    {preview.withholding > 0 && (
                      <tr>
                        <td>源泉徴収税額</td>
                        <td>−{yen(preview.withholding)}</td>
                      </tr>
                    )}
                    <tr className="invoice-total">
                      <td>振込予定額</td>
                      <td>{yen(preview.transferAmount)}</td>
                    </tr>
                    <tr>
                      <td>支払期日</td>
                      <td>{fmtDate(preview.dueDate)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
              {issueError && <div className="form-error">{issueError}</div>}
              {issued && (
                <div className="form-success">
                  <Check size={14} /> {issued} を発行しました。下の一覧からPDFをダウンロードできます。
                </div>
              )}
              <button className="btn-primary btn-lg" onClick={issue} disabled={issuing || !engagementId}>
                <Receipt size={18} /> {issuing ? "発行中…" : "この内容で請求書を発行"}
              </button>
            </>
          )}
        </section>

        {/* 税金の取り分け */}
        <section className="panel" id="tax" style={{ scrollMarginTop: 80 }}>
          <div className="panel-head">
            <h2>
              <Landmark size={18} /> 税金の取り分け
            </h2>
          </div>
          {reserve && (
            <>
              <div className="stat">
                <span className="stat-label">入金のたびに取り分ける目安</span>
                <span className="stat-value" style={{ fontSize: 44 }}>
                  {pct(reserve.reserveRate).replace("%", "")}
                  <small>%</small>
                </span>
                <span className="stat-sub">
                  月あたり約{man(reserve.monthlyReserve)}／年間 約{man(reserve.totalAnnual)}
                </span>
              </div>
              <div className="reserve-bar" aria-hidden>
                {reserve.items.map((i) => (
                  <span key={i.key} style={{ width: `${(i.annual / Math.max(1, reserve.totalAnnual)) * 100}%`, background: RESERVE_COLORS[i.key] }} />
                ))}
              </div>
              <div className="table-wrap">
                <table className="table">
                  <tbody>
                    {reserve.items.map((i) => (
                      <tr key={i.key}>
                        <td>
                          <span className="inline" style={{ gap: 6 }}>
                            <span className="legend-swatch" style={{ background: RESERVE_COLORS[i.key] }} />
                            <strong style={{ fontSize: 13 }}>{i.label}</strong>
                          </span>
                          <div className="small muted">{i.when}</div>
                        </td>
                        <td className="r">{man(i.annual)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label>
                経費率 {expenseRatio}%
                <input type="range" min={0} max={50} value={expenseRatio} onChange={(e) => setExpenseRatio(Number(e.target.value))} />
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={blue} onChange={(e) => setBlue(e.target.checked)} /> 青色申告（65万円控除）
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={invoiceRegistered} onChange={(e) => setInvoiceRegistered(e.target.checked)} /> インボイス登録している
              </label>
              <div className="callout-inline callout-info">
                <Info size={16} />
                <span>
                  消費税は「{reserve.consumptionTaxLabel}」で計算しています。インボイスの2割特例は2026年分まで、2027・2028年分は個人事業者に限り3割特例になります。
                </span>
              </div>
              <p className="disclaimer">
                ※ 月単価×12か月をもとにした概算です。住民税・国民健康保険は自治体や家族構成で大きく変わります。正確な金額は税理士・自治体にご確認ください。
              </p>
            </>
          )}
        </section>
      </div>

      {/* 請求書一覧 */}
      <section className="panel">
        <div className="panel-head">
          <h2>
            <Receipt size={18} /> 請求書と入金
          </h2>
        </div>
        {invoices.length === 0 && <div className="empty-state">まだ請求書はありません</div>}
        <div>
          {invoices.map((inv) => {
            const badge = STATE_BADGE[inv.state];
            return (
              <div key={inv.id}>
                <div className="invoice-row">
                  <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                    <div className="inline">
                      <span className={`badge ${badge.cls}`}>{badge.label}</span>
                      <strong>{inv.targetMonth.replace("-", "年")}月分</strong>
                      <span className="small muted">{inv.engagement.project.client}</span>
                    </div>
                    <div className="small muted">
                      {inv.invoiceNumber}
                      {inv.workHours != null && `・${inv.workHours}h`}
                      {inv.adjustment !== 0 && `・精算 ${inv.adjustment > 0 ? "+" : "−"}${yen(Math.abs(inv.adjustment))}`}
                      {inv.dueDate && `・期日 ${fmtDate(inv.dueDate)}`}
                      {inv.paidAt && `・${fmtDate(inv.paidAt)} 入金`}
                    </div>
                  </div>
                  <div className="invoice-amount">
                    <div className="num">{yen(inv.totalAmount - inv.withholding)}</div>
                    <div className="small muted">税込</div>
                  </div>
                  <div className="money-card-actions">
                    <button className="btn-secondary btn-sm" onClick={() => downloadFile(`/money/invoices/${inv.id}/pdf`, `${inv.invoiceNumber}.pdf`)}>
                      <Download size={14} /> PDF
                    </button>
                    {inv.state === "overdue" && (
                      <button className="btn-accent btn-sm" onClick={() => showReminder(inv)}>
                        <Mail size={14} /> 催促文
                      </button>
                    )}
                    <button className={inv.state === "paid" ? "btn-ghost btn-sm" : "btn-primary btn-sm"} onClick={() => togglePaid(inv)}>
                      {inv.state === "paid" ? "入金を取り消す" : (<><Check size={14} /> 入金を確認</>)}
                    </button>
                  </div>
                </div>
                {reminder?.id === inv.id && (
                  <div className="stack" style={{ paddingBottom: 16 }}>
                    <div className="reminder-box">{reminder.text}</div>
                    <div className="inline">
                      <button
                        className="btn-primary btn-sm"
                        onClick={() => navigator.clipboard.writeText(reminder.text).then(() => setCopied(true))}
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "コピーしました" : "コピーする"}
                      </button>
                      <button className="btn-ghost btn-sm" onClick={() => setReminder(null)}>
                        閉じる
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
