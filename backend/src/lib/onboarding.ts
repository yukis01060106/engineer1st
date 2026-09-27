// 登録直後の「はじめの一歩」。何から始めればいいか迷わないよう、働き方に合わせた最初の行動を並べる
// （DBに依存しない純粋関数。フロントのデモ版でも使う）

export interface OnboardingInput {
  workStyle: string;
  clubCount: number;
  eventCount: number;
  healthLogCount: number;
  hasWealthPlan: boolean;
  hasSkillSheet: boolean;
  engagementCount: number;
  hasInvoiceNumber: boolean;
}

export interface OnboardingStep {
  key: string;
  title: string;
  why: string;
  path: string;
  done: boolean;
}

export function buildOnboarding(i: OnboardingInput) {
  const steps: OnboardingStep[] = [
    { key: "club", title: "部活に入る", why: "体を動かしながら、現場の外に仲間ができます", path: "/clubs", done: i.clubCount > 0 },
    { key: "event", title: "勉強会か部活の活動に申し込む", why: "参加URL・集合場所がホームに届きます", path: "/community", done: i.eventCount > 0 },
  ];
  if (i.workStyle === "freelance") {
    steps.push(
      { key: "engagement", title: "いまの取引先を登録する", why: "請求書づくり・入金チェック・契約終了のお知らせが使えます", path: "/money#engagement", done: i.engagementCount > 0 },
      { key: "invoice_number", title: "インボイス登録番号を設定する", why: "請求書に自動で記載されます", path: "/settings", done: i.hasInvoiceNumber }
    );
  }
  steps.push(
    { key: "plan", title: "将来の備えプランをつくる", why: "税金の取り分けと積立の目安が、あなたの数字で出ます", path: "/wealth", done: i.hasWealthPlan },
    { key: "skill", title: "スキルシートをつくる", why: "足りない項目だけ入れれば、Excelで出力できます", path: "/skill-sheet", done: i.hasSkillSheet },
    { key: "health", title: "今日のコンディションを記録する", why: "10秒で終わります。続けると変化が見えます", path: "/health", done: i.healthLogCount > 0 }
  );
  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, total: steps.length, completed: doneCount === steps.length };
}
