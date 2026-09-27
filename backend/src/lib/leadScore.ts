// 見込み客のスコア: 「いま案件の提案を喜んでもらえそうか」（DBに依存しない純粋関数。デモ版でも使う）

export interface LeadInput {
  workStyle: string;
  currentEngagementDaysLeft: number | null; // 稼働中でなければ null
  hasCurrentEngagement: boolean;
  hasSkillSheet: boolean;
  rateDiagnosisCount: number;
  clubCount: number;
  eventCount: number;
  loggedHealthRecently: boolean;
  referred: boolean; // 招待リンク経由で登録した
  referralCount: number; // この人が招待して登録した人数
}

export function scoreLead(l: LeadInput): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (l.currentEngagementDaysLeft != null && l.currentEngagementDaysLeft <= 60) {
    score += 40;
    reasons.push(`契約終了まで${l.currentEngagementDaysLeft}日`);
  }
  if (l.workStyle === "freelance" && !l.hasCurrentEngagement) {
    score += 35;
    reasons.push("稼働中の案件なし");
  }
  if (l.workStyle === "considering") {
    score += 30;
    reasons.push("独立を検討中");
  }
  if (l.workStyle === "ses_employee") {
    score += 10;
    reasons.push("SES会社員（将来の独立候補）");
  }
  if (l.hasSkillSheet) {
    score += 15;
    reasons.push("スキルシート作成済み");
  }
  if (l.rateDiagnosisCount > 0) {
    score += 10;
    reasons.push("単価診断を利用");
  }
  const engagement = l.clubCount + l.eventCount + (l.loggedHealthRecently ? 1 : 0);
  if (engagement > 0) {
    score += Math.min(15, engagement * 5);
    reasons.push(`コミュニティ参加 ${l.clubCount}部・${l.eventCount}イベント`);
  }
  if (l.referred) {
    score += 5;
    reasons.push("紹介で登録");
  }
  if (l.referralCount > 0) {
    score += Math.min(10, l.referralCount * 5);
    reasons.push(`${l.referralCount}人を招待`);
  }
  return { score: Math.min(100, score), reasons };
}
