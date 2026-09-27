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

// 伸ばし方の目安（勉強会のタグ・案件のスキルと同じ表記にそろえる）
export const LEARNING_TIPS: Record<string, string> = {
  TypeScript: "既存のJSを1ファイルずつ型付けしていくのが近道。strict モードで型エラーをゼロにする練習を。",
  React: "小さなアプリをフックだけで作り切る。状態管理とメモ化の使いどころを説明できると強い。",
  "Next.js": "App Router で SSG / ISR / サーバーコンポーネントを使い分けた個人サイトを作ってみる。",
  AWS: "Lambda + API Gateway + DynamoDB で小さなAPIを作る。資格ならソリューションアーキテクト アソシエイト。",
  Go: "CLIツールや小さなAPIサーバーを書いて、goroutine とエラー処理の流儀に慣れる。",
  Python: "データ処理のスクリプトから。FastAPI で API を作れると、生成AI系の案件にもつながる。",
  Kubernetes: "kind や minikube で手元にクラスタを立て、Deployment と Service を自分で書く。",
  "Node.js": "Express か Fastify で認証つきAPIを作り、テストまで書き切る。",
};

export interface SkillGap {
  name: string;
  marketDemand: number;
  myLevel: number;
  gap: number;
  tip: string;
}

export function computeSkillGaps(mySkills: { name: string; level: number }[]): SkillGap[] {
  const myMap = new Map(mySkills.map((s) => [s.name.toLowerCase(), s.level]));
  const gaps = Object.entries(MARKET_DEMAND).map(([name, demand]) => {
    const myLevelScaled = (myMap.get(name.toLowerCase()) ?? 0) * 20; // 1-5 -> 20-100 スケール
    return { name, marketDemand: demand, myLevel: myLevelScaled, gap: demand - myLevelScaled, tip: LEARNING_TIPS[name] ?? "" };
  });
  gaps.sort((a, b) => b.gap - a.gap);
  return gaps;
}
