// スキルギャップ: 市場で人気の高いスキル（モック集計値）と、自分の保有レベルを比べる

export const MARKET_DEMAND: Record<string, number> = {
  TypeScript: 90,
  React: 88,
  "Next.js": 80,
  AWS: 85,
  Go: 65,
  Python: 82,
  Kubernetes: 70,
  "Node.js": 78,
};

export function computeSkillGaps(mySkills: { name: string; level: number }[]) {
  const myMap = new Map(mySkills.map((s) => [s.name, s.level]));
  const gaps = Object.entries(MARKET_DEMAND).map(([name, demand]) => {
    const myLevelScaled = (myMap.get(name) ?? 0) * 20; // 1-5 -> 20-100 スケール
    return { name, marketDemand: demand, myLevel: myLevelScaled, gap: demand - myLevelScaled };
  });
  gaps.sort((a, b) => b.gap - a.gap);
  return gaps;
}
