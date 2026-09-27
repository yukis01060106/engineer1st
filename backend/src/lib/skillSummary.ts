// スキルシートの入力から、■セクション形式のサマリーシート（文章）を自動生成する
import { groupSkillsByCategory } from "./skillCategory";

export function generateSummary(input: {
  name: string;
  age?: number | null;
  nearestStation?: string | null;
  availability?: string | null;
  desiredRate?: number | null;
  totalExperienceYears?: number | null;
  workProcesses: string[];
  appealPoints: string[];
  remarks?: string | null;
  skills: { name: string; level: number; years: number }[];
  experiences: { title: string; period: string; role: string; tech: string; description: string }[];
}): string {
  const grouped = groupSkillsByCategory(input.skills);
  const skillLines = grouped.map(
    (g) => ` ${g.category}：${g.skills.map((s) => `${s.strong ? "★ " : ""}${s.name}`).join(" / ")}`
  );

  const latestRole = input.experiences[0]?.role ?? "エンジニア";
  const projectCount = input.experiences.length;

  const lines: string[] = [];
  lines.push("■ 基本情報");
  lines.push(`氏名   ：${input.name}`);
  if (input.age) lines.push(`年齢   ：${input.age}歳`);
  if (input.nearestStation) lines.push(`最寄駅  ：${input.nearestStation}`);
  lines.push(`稼働開始 ：${input.availability || "応相談"}`);
  lines.push(`単価   ：${input.desiredRate ? `${input.desiredRate.toLocaleString()}円〜` : "応相談"}`);
  lines.push("");
  lines.push("■ スキルサマリー（★＝特に強い領域）");
  lines.push(...skillLines);
  lines.push("");
  if (input.workProcesses.length > 0) {
    lines.push("■ 対応可能工程");
    lines.push(` ${input.workProcesses.join(" → ")}`);
    lines.push("");
  }
  if (input.appealPoints.length > 0) {
    lines.push("■ アピールポイント");
    input.appealPoints.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
    lines.push("");
  }
  lines.push(
    `■ 経験概要（IT開発経験：${input.totalExperienceYears ? `約${input.totalExperienceYears}年` : "-"}）`
  );
  lines.push(
    ` ${latestRole}として${projectCount}件のプロジェクトに参画。プロジェクト経歴・保有スキルをもとに自動生成されたサマリーです（必要に応じて編集してください）。`
  );
  if (input.remarks) {
    lines.push("");
    lines.push("■ 備考／PR");
    lines.push(input.remarks);
  }

  return lines.join("\n");
}
