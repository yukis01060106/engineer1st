import { dateParts } from "../lib/format";

export function EventDate({ date }: { date: string }) {
  const p = dateParts(date);
  return (
    <div className="event-date" aria-label={`${p.month} ${p.day}日（${p.weekday}）`}>
      <span className="m">{p.month}</span>
      <span className="d">{p.day}</span>
      <span className="w">{p.weekday}</span>
    </div>
  );
}
