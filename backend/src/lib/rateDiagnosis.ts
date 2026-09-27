// 単価・商流診断: 似た条件の申告データ（なければ業界の目安）と比べて、単価の位置づけを返す。断定はしない

// 十分な自己申告データが溜まるまでの間、参考にする業界のざっくりした目安（月単価・円）
// 出典: 各種フリーランスエンジニア向け単価調査の公開レンジを参考にした概算値。実データが増えるほどこの目安の重みは下がる。
export const INDUSTRY_BASELINE: Record<string, number> = {
  フロントエンドエンジニア: 650_000,
  バックエンドエンジニア: 680_000,
  インフラエンジニア: 700_000,
  フルスタックエンジニア: 720_000,
  データエンジニア: 750_000,
  "PM/PMO": 780_000,
};

export const EXPERIENCE_BAND = 2; // 経験年数の比較幅（±年）
const MIN_SAMPLE_FOR_COMPARISON = 5;

export interface RateInput {
  primarySkill: string;
  role: string;
  yearsOfExperience: number;
  monthlyRate: number;
  chainDepth?: number;
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function chainDepthNote(chainDepth?: number): string | null {
  if (!chainDepth) return null;
  if (chainDepth >= 3) {
    return "商流の階層が3社以上の場合、業界データでは中抜き率が40%以上になっているケースが多く報告されています。ご自身の契約条件を確認してみることをおすすめします（あくまで業界傾向であり、個別の契約を断定するものではありません）。";
  }
  return "商流の階層が浅い場合は、中間マージンの影響を比較的受けにくい傾向があります。";
}

// similarRates: 同じ役割・主要スキルで、経験年数が ±EXPERIENCE_BAND 以内の申告単価
export function diagnoseRate(input: RateInput, similarRates: number[]) {
  const hasEnoughData = similarRates.length >= MIN_SAMPLE_FOR_COMPARISON;
  const baselines = Object.values(INDUSTRY_BASELINE);
  const comparisonRate = hasEnoughData
    ? median(similarRates)
    : INDUSTRY_BASELINE[input.role] ?? Math.round(baselines.reduce((a, b) => a + b, 0) / baselines.length);

  const diffRatio = Math.round(((input.monthlyRate - comparisonRate) / comparisonRate) * 1000) / 10;

  let message: string;
  if (diffRatio >= 5) {
    message = `似た条件のエンジニアの相場と比べて、あなたの単価は約${diffRatio}%高い可能性があります。`;
  } else if (diffRatio <= -5) {
    message = `似た条件のエンジニアの相場と比べて、あなたの単価は約${Math.abs(diffRatio)}%低い可能性があります。`;
  } else {
    message = "似た条件のエンジニアの相場とほぼ同水準の可能性があります。";
  }

  return {
    comparisonRate,
    dataSource: hasEnoughData ? ("similar_users" as const) : ("industry_baseline" as const),
    sampleSize: similarRates.length,
    diffRatio,
    message,
    chainDepthNote: chainDepthNote(input.chainDepth),
    disclaimer:
      "本診断はユーザーの自己申告データ、および入力データが不足する場合は業界の公開情報に基づく概算です。実際の契約内容や市場価値を保証するものではありません。",
  };
}
