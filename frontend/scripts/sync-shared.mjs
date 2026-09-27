// backend/src/lib の「DBに依存しない計算ロジック」をフロントにコピーする（デモ版＝GitHub Pages で使う）。
// 正本は backend 側。ここにコピーされた src/shared は編集しないこと（git 管理外・build/dev の前に自動実行）。
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const from = path.join(here, "../../backend/src/lib");
const to = path.join(here, "../src/shared");

const FILES = [
  "alerts.ts",
  "chatReply.ts",
  "expenseCsv.ts",
  "fpRules.ts",
  "fpSnapshot.ts",
  "invoice.ts",
  "leadScore.ts",
  "onboarding.ts",
  "planner.ts",
  "rank.ts",
  "rateDiagnosis.ts",
  "recommend.ts",
  "rewardSimulator.ts",
  "skillCategory.ts",
  "skillGap.ts",
  "skillSummary.ts",
  "taxReserve.ts",
  "wealth.ts",
];

await mkdir(to, { recursive: true });
for (const f of FILES) {
  await copyFile(path.join(from, f), path.join(to, f));
  const text = await readFile(path.join(to, f), "utf8");
  await writeFile(path.join(to, f), `// 自動生成: backend/src/lib/${f} のコピー（scripts/sync-shared.mjs）。編集は backend 側で。\n${text}`);
}
console.log(`shared: ${FILES.length} files synced`);
