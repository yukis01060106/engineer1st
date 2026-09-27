// インボイス制度対応: 適格請求書に必要な税率区分・消費税額の計算と、SES特有の精算幅・支払期日の計算
import { randomBytes } from "crypto";

export interface TaxBreakdown {
  amount: number; // 税抜金額
  taxRate: number; // 適用税率（%）
  taxAmount: number; // 消費税額
  totalAmount: number; // 税込合計
}

export function calcTax(amount: number, taxRate = 10): TaxBreakdown {
  const taxAmount = Math.round(amount * (taxRate / 100));
  return {
    amount,
    taxRate,
    taxAmount,
    totalAmount: amount + taxAmount,
  };
}

export interface SettlementInput {
  monthlyRate: number;
  workHours: number | null; // 未入力なら精算なし（固定額）
  settlementMin: number;
  settlementMax: number;
}

export interface SettlementResult {
  baseAmount: number;
  adjustment: number; // 超過(+)・控除(-)
  amount: number; // 精算後の税抜金額
  hourlyUnit: number; // 精算に使った時間単価（0なら精算なし）
  note: string;
}

// 精算幅の計算（上下割）。下限を割ったら「月額÷下限時間」で控除、上限を超えたら「月額÷上限時間」で超過分を加算する
export function calcSettlement(input: SettlementInput): SettlementResult {
  const { monthlyRate, workHours, settlementMin, settlementMax } = input;
  if (workHours == null) {
    return { baseAmount: monthlyRate, adjustment: 0, amount: monthlyRate, hourlyUnit: 0, note: "稼働時間の入力なし（固定額で請求）" };
  }
  if (workHours < settlementMin) {
    const unit = Math.floor(monthlyRate / settlementMin);
    const adjustment = -Math.round((settlementMin - workHours) * unit);
    return {
      baseAmount: monthlyRate,
      adjustment,
      amount: monthlyRate + adjustment,
      hourlyUnit: unit,
      note: `精算幅 ${settlementMin}〜${settlementMax}h／下限割れ ${(settlementMin - workHours).toFixed(1)}h × 控除単価 ${unit.toLocaleString()}円`,
    };
  }
  if (workHours > settlementMax) {
    const unit = Math.floor(monthlyRate / settlementMax);
    const adjustment = Math.round((workHours - settlementMax) * unit);
    return {
      baseAmount: monthlyRate,
      adjustment,
      amount: monthlyRate + adjustment,
      hourlyUnit: unit,
      note: `精算幅 ${settlementMin}〜${settlementMax}h／超過 ${(workHours - settlementMax).toFixed(1)}h × 超過単価 ${unit.toLocaleString()}円`,
    };
  }
  return {
    baseAmount: monthlyRate,
    adjustment: 0,
    amount: monthlyRate,
    hourlyUnit: 0,
    note: `精算幅 ${settlementMin}〜${settlementMax}h の範囲内（${workHours}h）`,
  };
}

// 源泉徴収税額（報酬100万円以下は10.21%、超える部分は20.42%）。
// システム開発の業務委託は通常は源泉徴収の対象外。デザイン・原稿料など対象業務を含む場合のみ使う。
export function calcWithholding(amount: number): number {
  if (amount <= 1_000_000) return Math.floor(amount * 0.1021);
  return Math.floor(1_000_000 * 0.1021 + (amount - 1_000_000) * 0.2042);
}

// フリーランス法: 給付を受領した日（SESの月次稼働なら月末）から60日以内に支払期日を定める必要がある
export const FREELANCE_ACT_MAX_DAYS = 60;

export function monthEnd(targetMonth: string): Date {
  const [y, m] = targetMonth.split("-").map(Number);
  return new Date(y, m, 0, 23, 59, 59);
}

export function calcDueDate(targetMonth: string, paymentTermDays: number): Date {
  const due = monthEnd(targetMonth);
  due.setDate(due.getDate() + paymentTermDays);
  return due;
}

export function invoiceState(inv: { paidAt: Date | null; dueDate: Date | null }, now = new Date()) {
  if (inv.paidAt) return "paid" as const;
  if (inv.dueDate && inv.dueDate.getTime() < now.getTime()) return "overdue" as const;
  return "unpaid" as const;
}

// 請求書番号: 年月＋ランダム。サーバー再起動で連番がリセットされても重複しないようにする
export function nextInvoiceNumber(targetMonth: string): string {
  return `INV-${targetMonth.replace("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
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
  const due = p.dueDate.toLocaleDateString("ja-JP");
  return [
    `${p.clientName}`,
    `ご担当者様`,
    ``,
    `いつもお世話になっております。${p.userName}です。`,
    ``,
    `${p.targetMonth.replace("-", "年")}月分のご請求（請求書番号：${p.invoiceNumber}、ご請求金額：${p.totalAmount.toLocaleString()}円）につきまして、`,
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
