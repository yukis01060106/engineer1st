// インボイス制度対応: 適格請求書に必要な税率区分・消費税額の計算と、SES特有の精算幅・支払期日の計算
// ※ このファイルはフロントのデモ版（GitHub Pages）からも読み込むため、Node専用のモジュールに依存しないこと

const DAY = 86_400_000;
const TZ = "Asia/Tokyo";

export interface TaxBreakdown {
  amount: number; // 税抜金額
  taxRate: number; // 適用税率（%）
  taxAmount: number; // 消費税額
  totalAmount: number; // 税込合計
}

// 消費税額は「一の適格請求書につき、税率ごとに1回」端数処理する（ここでは切り捨て）
export function calcTax(amount: number, taxRate = 10): TaxBreakdown {
  const taxAmount = Math.floor(amount * (taxRate / 100));
  return { amount, taxRate, taxAmount, totalAmount: amount + taxAmount };
}

// ---------- 精算幅 ----------
// updown: 上下割（控除は 月額÷下限、超過は 月額÷上限）／ middle: 中間割（どちらも 月額÷中間時間）／ fixed: 精算なし（月額固定）
export type SettlementMethod = "updown" | "middle" | "fixed";
export const SETTLEMENT_METHOD_LABEL: Record<SettlementMethod, string> = {
  updown: "上下割",
  middle: "中間割",
  fixed: "精算なし（固定）",
};

export interface SettlementTerms {
  monthlyRate: number;
  settlementMin: number;
  settlementMax: number;
  settlementMethod?: string; // SettlementMethod（未指定は上下割）
  unitRounding?: number; // 時間単価の切り捨て単位（1・10・100円）
  hoursUnitMinutes?: number; // 稼働時間の切り捨て単位（1・15・30・60分）
}

export interface SettlementInput extends SettlementTerms {
  workHours: number | null; // 未入力なら精算なし（固定額）
}

export interface SettlementResult {
  baseAmount: number;
  adjustment: number; // 超過(+)・控除(-)
  amount: number; // 精算後の税抜金額
  hourlyUnit: number; // 精算に使った時間単価（0なら精算なし）
  settledHours: number | null; // 単位で切り捨てた後の稼働時間
  diffHours: number; // 超過(+)・控除(-)の時間
  note: string;
}

const floorTo = (n: number, unit: number) => Math.floor(n / unit) * unit;

export function roundHours(hours: number, unitMinutes = 1): number {
  if (unitMinutes <= 1) return Math.round(hours * 100) / 100;
  const unit = unitMinutes / 60;
  return Math.round(floorTo(hours + 1e-9, unit) * 100) / 100;
}

export function calcSettlement(input: SettlementInput): SettlementResult {
  const { monthlyRate, workHours, settlementMin, settlementMax } = input;
  const method = (input.settlementMethod ?? "updown") as SettlementMethod;
  const rounding = input.unitRounding && input.unitRounding > 0 ? input.unitRounding : 1;
  const base = { baseAmount: monthlyRate, adjustment: 0, amount: monthlyRate, hourlyUnit: 0, diffHours: 0 };

  if (workHours == null) return { ...base, settledHours: null, note: "稼働時間の入力なし（月額で請求）" };
  const hours = roundHours(workHours, input.hoursUnitMinutes);
  if (method === "fixed") return { ...base, settledHours: hours, note: `精算なし（月額固定・稼働 ${hours}h）` };

  const range = `精算幅 ${settlementMin}〜${settlementMax}h`;
  const middle = (settlementMin + settlementMax) / 2;
  if (hours < settlementMin) {
    const unit = floorTo(monthlyRate / (method === "middle" ? middle : settlementMin), rounding);
    const diff = Math.round((settlementMin - hours) * 100) / 100;
    const adjustment = -Math.floor(diff * unit);
    return {
      baseAmount: monthlyRate,
      adjustment,
      amount: monthlyRate + adjustment,
      hourlyUnit: unit,
      settledHours: hours,
      diffHours: -diff,
      note: `${range}（${SETTLEMENT_METHOD_LABEL[method]}）／不足 ${diff}h × 控除単価 ${unit.toLocaleString()}円`,
    };
  }
  if (hours > settlementMax) {
    const unit = floorTo(monthlyRate / (method === "middle" ? middle : settlementMax), rounding);
    const diff = Math.round((hours - settlementMax) * 100) / 100;
    const adjustment = Math.floor(diff * unit);
    return {
      baseAmount: monthlyRate,
      adjustment,
      amount: monthlyRate + adjustment,
      hourlyUnit: unit,
      settledHours: hours,
      diffHours: diff,
      note: `${range}（${SETTLEMENT_METHOD_LABEL[method]}）／超過 ${diff}h × 超過単価 ${unit.toLocaleString()}円`,
    };
  }
  return { ...base, settledHours: hours, note: `${range} の範囲内（${hours}h）` };
}

// ---------- 源泉徴収 ----------
// 報酬（税抜で区分して記載している場合は税抜額）が100万円以下は10.21%、超える部分は20.42%。1円未満切り捨て。
// システム開発の業務委託は通常は源泉徴収の対象外。デザイン・原稿料・講演料など対象業務を含む場合のみ使う。
export function calcWithholding(amount: number): number {
  if (amount <= 1_000_000) return Math.floor(amount * 0.1021);
  return Math.floor(102_100 + (amount - 1_000_000) * 0.2042);
}

// ---------- 日付（日本時間） ----------
// フリーランス法: 給付を受領した日（SESの月次稼働なら月末）から60日以内に支払期日を定める必要がある
export const FREELANCE_ACT_MAX_DAYS = 60;

// 対象月の末日 23:59:59（日本時間）
export function monthEnd(targetMonth: string): Date {
  const [y, m] = targetMonth.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0, 14, 59, 59));
}

export function monthStart(targetMonth: string): Date {
  const [y, m] = targetMonth.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1, -9, 0, 0));
}

export function calcDueDate(targetMonth: string, paymentTermDays: number): Date {
  return new Date(monthEnd(targetMonth).getTime() + paymentTermDays * DAY);
}

export const fmtJaDate = (d: Date) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: TZ, year: "numeric", month: "long", day: "numeric" }).format(d);

export const monthLabel = (targetMonth: string) => `${Number(targetMonth.slice(0, 4))}年${Number(targetMonth.slice(5, 7))}月`;

export function invoiceState(inv: { paidAt: Date | null; dueDate: Date | null }, now = new Date()) {
  if (inv.paidAt) return "paid" as const;
  if (inv.dueDate && inv.dueDate.getTime() < now.getTime()) return "overdue" as const;
  return "unpaid" as const;
}

// 請求書番号: 対象年月＋ランダム。サーバー再起動で連番がリセットされても重複しないようにする
export function nextInvoiceNumber(targetMonth: string): string {
  const suffix = Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase().padStart(6, "0");
  return `INV-${targetMonth.replace("-", "")}-${suffix}`;
}

// ---------- 請求書の発行者情報（設定画面で登録。発行のたびに請求書へ写しておく） ----------
export interface BankAccount {
  bankName: string;
  branchName: string;
  accountType: string; // 普通 / 当座
  accountNumber: string;
  accountHolder: string; // 口座名義（カナ）
}

export interface BillingProfile {
  businessName?: string; // 屋号
  postalCode?: string;
  address?: string;
  phone?: string;
  bank?: BankAccount | null;
}

export interface IssuerInfo extends BillingProfile {
  name: string;
  email: string;
  registrationNumber: string | null; // 適格請求書発行事業者の登録番号（T＋13桁）。なければ通常の請求書
}

export const REGISTRATION_NUMBER_PATTERN = /^T\d{13}$/;

export function parseBillingProfile(json: string | null | undefined): BillingProfile {
  try {
    return json ? (JSON.parse(json) as BillingProfile) : {};
  } catch {
    return {};
  }
}

export function bankComplete(b: BankAccount | null | undefined): b is BankAccount {
  return !!b && !!b.bankName && !!b.branchName && !!b.accountNumber && !!b.accountHolder;
}

// ---------- 請求書1件ぶんの保存内容を組み立てる（サーバー・シード・デモで共通） ----------
export interface InvoiceInput {
  targetMonth: string;
  workHours: number | null;
  applyWithholding: boolean;
  notes?: string | null;
}

export interface InvoiceTerms extends SettlementTerms {
  paymentTermDays: number;
}

export function buildInvoiceRecord(terms: InvoiceTerms, input: InvoiceInput, issuer: IssuerInfo, recipient: { name: string; projectTitle: string }) {
  const settlement = calcSettlement({ ...terms, workHours: input.workHours });
  const tax = calcTax(settlement.amount, 10);
  const withholding = input.applyWithholding ? calcWithholding(settlement.amount) : 0;
  return {
    targetMonth: input.targetMonth,
    amount: tax.amount,
    baseAmount: settlement.baseAmount,
    workHours: input.workHours,
    settledHours: settlement.settledHours,
    adjustment: settlement.adjustment,
    hourlyUnit: settlement.hourlyUnit,
    settlementNote: settlement.note,
    withholding,
    taxRate: tax.taxRate,
    taxAmount: tax.taxAmount,
    totalAmount: tax.totalAmount,
    transferAmount: tax.totalAmount - withholding,
    dueDate: calcDueDate(input.targetMonth, terms.paymentTermDays),
    registrationNumber: issuer.registrationNumber ?? "",
    recipientName: recipient.name,
    subject: `${recipient.projectTitle} 業務委託料（${monthLabel(input.targetMonth)}分）`,
    notes: input.notes?.trim() || null,
    issuerInfo: JSON.stringify(issuer),
  };
}

// ---------- 請求書の見た目（PDF・印刷用ページで共通） ----------
export interface InvoiceLine {
  label: string;
  detail?: string;
  quantity: string;
  unitPrice: number | null;
  amount: number;
}

export interface InvoiceDocument {
  title: string;
  qualified: boolean; // 適格請求書（登録番号あり）かどうか
  number: string;
  issuedAt: string; // 表示用
  dueDate: string | null;
  recipient: string;
  subject: string;
  period: string; // 取引年月日（役務を提供した期間）
  lines: InvoiceLine[];
  taxSummary: { rate: number; base: number; tax: number }[];
  subtotal: number;
  taxTotal: number;
  total: number;
  withholding: number;
  transfer: number;
  issuer: IssuerInfo;
  bankLines: string[];
  notes: string[];
}

export function buildInvoiceDocument(inv: {
  invoiceNumber: string;
  targetMonth: string;
  issuedAt: Date;
  dueDate: Date | null;
  amount: number;
  baseAmount: number;
  workHours: number | null;
  settledHours?: number | null;
  adjustment: number;
  hourlyUnit?: number;
  settlementNote?: string | null;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  withholding: number;
  registrationNumber: string;
  recipientName?: string | null;
  subject?: string | null;
  notes?: string | null;
  issuerInfo?: string | null;
  fallbackIssuer: { name: string; email: string };
  fallbackRecipient: string;
  projectTitle: string;
}): InvoiceDocument {
  let issuer: IssuerInfo;
  try {
    issuer = inv.issuerInfo && inv.issuerInfo !== "{}" ? (JSON.parse(inv.issuerInfo) as IssuerInfo) : { ...inv.fallbackIssuer, registrationNumber: null };
  } catch {
    issuer = { ...inv.fallbackIssuer, registrationNumber: null };
  }
  const registration = inv.registrationNumber || issuer.registrationNumber || "";
  const qualified = REGISTRATION_NUMBER_PATTERN.test(registration);
  issuer = { ...issuer, registrationNumber: qualified ? registration : null };

  const month = monthLabel(inv.targetMonth);
  const lines: InvoiceLine[] = [
    {
      label: `${inv.projectTitle} システム開発支援`,
      detail: `${month}分（月額）${inv.settledHours != null || inv.workHours != null ? `・稼働 ${inv.settledHours ?? inv.workHours}時間` : ""}`,
      quantity: "1式",
      unitPrice: inv.baseAmount || inv.amount,
      amount: inv.baseAmount || inv.amount,
    },
  ];
  if (inv.adjustment !== 0) {
    const unit = inv.hourlyUnit ?? 0;
    const hours = unit > 0 ? Math.round((Math.abs(inv.adjustment) / unit) * 100) / 100 : null;
    lines.push({
      label: inv.adjustment > 0 ? "超過精算" : "控除精算",
      detail: inv.settlementNote ?? undefined,
      quantity: hours != null ? `${hours}時間` : "1式",
      unitPrice: unit > 0 ? (inv.adjustment > 0 ? unit : -unit) : null,
      amount: inv.adjustment,
    });
  }

  const bank = issuer.bank;
  const bankLines = bankComplete(bank)
    ? [`${bank.bankName} ${bank.branchName}`, `${bank.accountType || "普通"} ${bank.accountNumber}`, `口座名義 ${bank.accountHolder}`]
    : [];

  const notes = [
    "恐れ入りますが、お振込手数料は貴社にてご負担くださいますようお願いいたします。",
    ...(inv.withholding > 0 ? ["源泉徴収税額は、税抜の報酬額をもとに計算しています。"] : []),
    ...(!qualified ? ["当方は適格請求書発行事業者ではありません。"] : []),
    ...(inv.notes ? [inv.notes] : []),
  ];

  return {
    title: "請求書",
    qualified,
    number: inv.invoiceNumber,
    issuedAt: fmtJaDate(inv.issuedAt),
    dueDate: inv.dueDate ? fmtJaDate(inv.dueDate) : null,
    recipient: inv.recipientName || inv.fallbackRecipient,
    subject: inv.subject || `${inv.projectTitle} 業務委託料（${month}分）`,
    period: `${fmtJaDate(monthStart(inv.targetMonth))} 〜 ${fmtJaDate(monthEnd(inv.targetMonth))}`,
    lines,
    taxSummary: [{ rate: inv.taxRate, base: inv.amount, tax: inv.taxAmount }],
    subtotal: inv.amount,
    taxTotal: inv.taxAmount,
    total: inv.totalAmount,
    withholding: inv.withholding,
    transfer: inv.totalAmount - inv.withholding,
    issuer,
    bankLines,
    notes,
  };
}

// 支払いが遅れているときの催促文（丁寧・事実ベース・根拠条文を添える）
export function paymentReminderText(p: {
  clientName: string;
  userName: string;
  invoiceNumber: string;
  targetMonth: string;
  totalAmount: number;
  dueDate: Date;
}): string {
  const due = fmtJaDate(p.dueDate);
  return [
    `${p.clientName}`,
    `ご担当者様`,
    ``,
    `いつもお世話になっております。${p.userName}です。`,
    ``,
    `${monthLabel(p.targetMonth)}分のご請求（請求書番号：${p.invoiceNumber}、ご請求金額：${p.totalAmount.toLocaleString()}円）につきまして、`,
    `お支払期日の${due}を過ぎておりますが、現時点で入金を確認できておりません。`,
    ``,
    `行き違いでお手続き済みの場合はご容赦ください。`,
    `お手数ですが、お支払い状況とご入金予定日をご確認いただけますと幸いです。`,
    ``,
    `なお、フリーランス・事業者間取引適正化等法（第4条）により、報酬は給付の受領日から60日以内の期日に支払うこととされております。`,
    ``,
    `引き続きどうぞよろしくお願いいたします。`,
    `${p.userName}`,
  ].join("\n");
}
