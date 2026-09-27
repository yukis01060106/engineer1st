import { CheckCircle2, Circle, Trash2 } from "lucide-react";

// カレンダー・ToDo の1行（カレンダー画面とホームで共通）
export interface Task {
  id: string;
  title: string;
  kind: "todo" | "event";
  date: string | null;
  time: string | null;
  memo: string | null;
  doneAt: string | null;
}

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// 日本時間の今日 "YYYY-MM-DD"
export const todayJst = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export const labelOf = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  const w = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${m}月${d}日（${w}）`;
};

export function TaskRow({
  task: t,
  onToggle,
  onRemove,
  showTime,
  showDate,
}: {
  task: Task;
  onToggle: (t: Task) => void;
  onRemove?: (t: Task) => void;
  showTime?: boolean;
  showDate?: boolean;
}) {
  const isTodo = t.kind === "todo";
  return (
    <li className={t.doneAt ? "is-done" : ""}>
      {isTodo ? (
        <button className="plan-check" onClick={() => onToggle(t)} aria-label={t.doneAt ? "未完了に戻す" : "完了にする"} aria-pressed={!!t.doneAt}>
          {t.doneAt ? <CheckCircle2 size={18} /> : <Circle size={18} />}
        </button>
      ) : (
        <span className="legend-swatch cal-dot-mine" />
      )}
      {showTime && (t.time || !isTodo) && <span className="num small muted plan-time">{t.time ?? "終日"}</span>}
      <span className="plan-title">
        {t.title}
        {t.memo && <span className="small muted" style={{ display: "block" }}>{t.memo}</span>}
      </span>
      {showDate && t.date && <span className="small muted num">{labelOf(t.date)}</span>}
      {onRemove && (
        <button className="plan-delete" onClick={() => onRemove(t)} aria-label={`「${t.title}」を削除`}>
          <Trash2 size={14} />
        </button>
      )}
    </li>
  );
}
