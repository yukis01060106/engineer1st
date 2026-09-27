// カレンダー・ToDo: 本人が登録した予定・やることに、ソトバ内の予定（勉強会・支払期日・契約終了）を重ねて表示する
// DBに依存しない純粋関数（フロントのデモ版でも使う）
import { invoiceState } from "./invoice";

export interface TaskRow {
  id: string;
  title: string;
  kind: string; // "todo" | "event"
  date: string | null;
  time: string | null;
  memo: string | null;
  doneAt: Date | string | null;
  createdAt: Date | string;
}

export interface AutoItem {
  id: string;
  date: string; // "2026-09-28"（日本時間）
  time: string | null;
  title: string;
  source: "event" | "invoice" | "engagement";
  path: string;
}

export interface AutoItemInput {
  now: Date;
  appliedEvents: { id: string; title: string; date: Date }[];
  unpaidInvoices: { id: string; targetMonth: string; dueDate: Date | null; paidAt: Date | null; client: string }[];
  currentEngagement: { endDate: Date | null; project: { title: string } } | null;
}

const TZ = "Asia/Tokyo";

// 日本時間の "YYYY-MM-DD"
export function jstDate(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function jstTime(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
}

export function buildAutoItems(input: AutoItemInput): AutoItem[] {
  const items: AutoItem[] = [];
  for (const e of input.appliedEvents) {
    items.push({ id: `event-${e.id}`, date: jstDate(e.date), time: jstTime(e.date), title: e.title, source: "event", path: `/events/${e.id}` });
  }
  for (const inv of input.unpaidInvoices) {
    if (!inv.dueDate) continue;
    const overdue = invoiceState(inv, input.now) === "overdue";
    items.push({
      id: `invoice-${inv.id}`,
      date: jstDate(inv.dueDate),
      time: null,
      title: `${overdue ? "【期日超過】" : ""}${inv.client}の入金期日（${inv.targetMonth}分）`,
      source: "invoice",
      path: "/money",
    });
  }
  if (input.currentEngagement?.endDate) {
    items.push({
      id: "engagement-end",
      date: jstDate(input.currentEngagement.endDate),
      time: null,
      title: `「${input.currentEngagement.project.title}」契約終了`,
      source: "engagement",
      path: "/money#engagement",
    });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
}

export const TASK_KINDS = ["todo", "event"] as const;
