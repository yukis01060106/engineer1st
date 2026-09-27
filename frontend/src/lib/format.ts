// 表示用フォーマット。サーバー（UTC）で描画しても日本時間で表示されるよう timeZone を固定する
const TZ = "Asia/Tokyo";

export const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;

export const man = (n: number) => {
  const v = n / 10_000;
  return `${v >= 100 ? Math.round(v).toLocaleString("ja-JP") : (Math.round(v * 10) / 10).toLocaleString("ja-JP")}万円`;
};

export const pct = (r: number) => `${Math.round(r * 100)}%`;

export function dateParts(iso: string | Date) {
  const d = new Date(iso);
  const get = (opt: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("ja-JP", { timeZone: TZ, ...opt }).format(d);
  return {
    month: new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short" }).format(d).toUpperCase(),
    day: get({ day: "numeric" }).replace("日", ""),
    weekday: get({ weekday: "short" }),
    time: get({ hour: "2-digit", minute: "2-digit" }),
  };
}

export const fmtDate = (iso: string | Date) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric" }).format(new Date(iso));

export const fmtDateTime = (iso: string | Date) =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: TZ,
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export const WORK_STYLE_LABEL: Record<string, string> = {
  freelance: "フリーランス",
  ses_employee: "SES会社員",
  considering: "独立を検討中",
};
