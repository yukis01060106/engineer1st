export type Rank = "ブロンズ" | "シルバー" | "ゴールド" | "プラチナ";

export interface RankBenefit {
  rank: Rank;
  yearsLabel: string;
  benefits: string[];
}

export const RANK_BENEFITS: RankBenefit[] = [
  {
    rank: "ブロンズ",
    yearsLabel: "〜1年",
    benefits: ["無料ツール全般", "勉強会参加", "支払通知書・請求書生成"],
  },
  {
    rank: "シルバー",
    yearsLabel: "1〜3年",
    benefits: ["メンター無料枠", "優良案件の優先紹介", "会計ソフト連携"],
  },
  {
    rank: "ゴールド",
    yearsLabel: "3〜5年",
    benefits: ["非公開案件アクセス", "福利厚生の一部", "確定申告サポート"],
  },
  {
    rank: "プラチナ",
    yearsLabel: "5年〜",
    benefits: ["福利厚生フル", "限定イベント", "税務相談枠", "専任サポート"],
  },
];

export function calcTenureYears(joinedAt: Date, now: Date = new Date()): number {
  const ms = now.getTime() - joinedAt.getTime();
  return ms / (1000 * 60 * 60 * 24 * 365.25);
}

export function calcRank(joinedAt: Date, now: Date = new Date()): Rank {
  const years = calcTenureYears(joinedAt, now);
  if (years >= 5) return "プラチナ";
  if (years >= 3) return "ゴールド";
  if (years >= 1) return "シルバー";
  return "ブロンズ";
}

// 現在のランクまでに開放済みの特典（累積）を返す
export function unlockedBenefits(rank: Rank): RankBenefit[] {
  const order: Rank[] = ["ブロンズ", "シルバー", "ゴールド", "プラチナ"];
  const idx = order.indexOf(rank);
  return RANK_BENEFITS.filter((b) => order.indexOf(b.rank) <= idx);
}

// 会員カード表示用の会員番号（ユーザーIDから決定論的に生成）
export function formatMemberNumber(userId: string): string {
  const alnum = userId.replace(/[^a-z0-9]/gi, "").toUpperCase();
  const digits = alnum.slice(-8).padStart(8, "0");
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}`;
}
