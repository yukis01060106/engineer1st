// スキルシート・サマリーシートの型と組み立て（サーバー・Excel・印刷用ページ・デモ版で共通。DBに依存しない）
// 構成はSES・フリーランス案件の紹介で一般的な型にそろえる:
//   基本情報（イニシャル・年齢・最寄駅・稼働開始・経験年数・資格）→ スキル要約（分類別・経験年数）→ 自己PR
//   → 職務経歴（期間・業務内容・役割・規模・環境・担当工程●）
import { groupSkillsByCategory, CategorizedSkills } from "./skillCategory";

export const PHASES = ["要件定義", "基本設計", "詳細設計", "製造", "単体テスト", "結合テスト", "総合テスト", "運用・保守"] as const;
export const PHASE_SHORT: Record<string, string> = {
  要件定義: "要件",
  基本設計: "基本",
  詳細設計: "詳細",
  製造: "製造",
  単体テスト: "単体",
  結合テスト: "結合",
  総合テスト: "総合",
  "運用・保守": "運用",
};
export const ROLE_OPTIONS = ["PM", "PL", "テックリード", "SE", "PG", "インフラエンジニア", "テスター", "PMO", "メンバー"];

export const ENV_FIELDS = [
  { key: "languages", label: "言語" },
  { key: "frameworks", label: "FW・ライブラリ" },
  { key: "databases", label: "DB" },
  { key: "os", label: "OS" },
  { key: "cloud", label: "クラウド・インフラ" },
  { key: "tools", label: "ツール" },
] as const;
export type EnvKey = (typeof ENV_FIELDS)[number]["key"];

export interface SkillItem {
  name: string;
  level: number; // 1〜5
  years: number;
}

export interface Qualification {
  name: string;
  acquired: string; // "2024-06"（任意）
}

export interface Experience {
  title: string; // プロジェクト名
  industry: string; // 業種（例: 金融・EC）
  startMonth: string; // "2024-04"
  endMonth: string | null; // null = 現在
  overview: string; // プロジェクト概要
  tasks: string; // 担当業務・成果
  role: string;
  teamSize: number | null;
  phases: string[];
  languages: string;
  frameworks: string;
  databases: string;
  os: string;
  cloud: string;
  tools: string;
}

export const EMPTY_EXPERIENCE: Experience = {
  title: "",
  industry: "",
  startMonth: "",
  endMonth: null,
  overview: "",
  tasks: "",
  role: "",
  teamSize: null,
  phases: [],
  languages: "",
  frameworks: "",
  databases: "",
  os: "",
  cloud: "",
  tools: "",
};

const YM = /^\d{4}-\d{2}$/;

// 旧形式（期間・使用技術・内容を自由記述）で保存されたデータも新しい形に読み替える
export function normalizeExperience(raw: Record<string, unknown>): Experience {
  const e = { ...EMPTY_EXPERIENCE, ...(raw as Partial<Experience>) };
  const legacy = raw as { period?: string; tech?: string; description?: string };
  if (!e.startMonth && legacy.period) {
    const m = legacy.period.match(/(\d{4})[-/.年](\d{1,2})/g) ?? [];
    const toYm = (s: string) => {
      const [, y, mo] = s.match(/(\d{4})[-/.年](\d{1,2})/)!;
      return `${y}-${mo.padStart(2, "0")}`;
    };
    if (m[0]) e.startMonth = toYm(m[0]);
    e.endMonth = m[1] ? toYm(m[1]) : null;
  }
  if (!e.languages && !e.frameworks && legacy.tech) {
    // 旧形式の「使用技術」は分類して振り分ける
    for (const t of legacy.tech.split(/[,、/]/).map((x) => x.trim()).filter(Boolean)) {
      const cat = groupSkillsByCategory([{ name: t, level: 1, years: 0 }])[0]?.category;
      const key: EnvKey = cat === "言語" ? "languages" : cat === "フレームワーク" ? "frameworks" : cat === "DB" ? "databases" : cat === "OS" ? "os" : cat === "クラウド・インフラ" ? "cloud" : "tools";
      e[key] = e[key] ? `${e[key]}, ${t}` : t;
    }
  }
  if (!e.tasks && legacy.description) e.tasks = legacy.description;
  e.phases = Array.isArray(e.phases) ? e.phases.filter((p) => (PHASES as readonly string[]).includes(p)) : [];
  e.teamSize = typeof e.teamSize === "number" && e.teamSize > 0 ? e.teamSize : null;
  if (e.startMonth && !YM.test(e.startMonth)) e.startMonth = "";
  if (e.endMonth && !YM.test(e.endMonth)) e.endMonth = null;
  return e;
}

// ---------- 期間 ----------
const ymIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
export const currentYm = (now = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit" }).format(now).slice(0, 7);

// 開始月〜終了月（両端を含む）の月数
export function monthsOf(e: Pick<Experience, "startMonth" | "endMonth">, now = new Date()): number {
  if (!e.startMonth) return 0;
  const end = e.endMonth ?? currentYm(now);
  return Math.max(1, ymIndex(end) - ymIndex(e.startMonth) + 1);
}

export function durationLabel(months: number): string {
  if (months <= 0) return "";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y}年` : "", m ? `${m}ヶ月` : ""].join("") || "1ヶ月";
}

const ymLabel = (ym: string) => `${ym.slice(0, 4)}/${ym.slice(5, 7)}`;
export function periodLabel(e: Pick<Experience, "startMonth" | "endMonth">): string {
  if (!e.startMonth) return "";
  return `${ymLabel(e.startMonth)} 〜 ${e.endMonth ? ymLabel(e.endMonth) : "現在"}`;
}

// 経歴の合計（重なる期間は1回だけ数える）
export function totalExperienceMonths(experiences: Pick<Experience, "startMonth" | "endMonth">[], now = new Date()): number {
  const months = new Set<number>();
  for (const e of experiences) {
    if (!e.startMonth) continue;
    const start = ymIndex(e.startMonth);
    const end = ymIndex(e.endMonth ?? currentYm(now));
    for (let i = start; i <= end; i++) months.add(i);
  }
  return months.size;
}

// 新しい順に並べる（終了月なし＝現在を先頭に）
export function sortExperiences(list: Experience[]): Experience[] {
  return [...list].sort((a, b) => (b.endMonth ?? "9999-99").localeCompare(a.endMonth ?? "9999-99") || b.startMonth.localeCompare(a.startMonth));
}

export function phasesUnion(list: Experience[]): string[] {
  const set = new Set(list.flatMap((e) => e.phases));
  return PHASES.filter((p) => set.has(p));
}

// 工程の範囲を「要件定義〜総合テスト」のように短くまとめる
export function phaseRangeLabel(phases: string[]): string {
  const idx = PHASES.map((p, i) => (phases.includes(p) ? i : -1)).filter((i) => i >= 0);
  if (idx.length === 0) return "";
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  return contiguous && idx.length > 2 ? `${PHASES[idx[0]]}〜${PHASES[idx[idx.length - 1]]}` : idx.map((i) => PHASES[i]).join("・");
}

// ---------- スキルシート（Excel・印刷用） ----------
export interface SkillSheetSource {
  name: string;
  initials: string | null;
  showFullName: boolean;
  age: number | null;
  gender: string | null;
  nearestStation: string | null;
  availability: string | null;
  desiredRate: number | null;
  totalExperienceYears: number | null;
  specialty: string | null;
  qualifications: Qualification[];
  appealPoints: string[];
  remarks: string | null;
  skills: SkillItem[];
  experiences: Experience[];
}

export interface SkillSheetDocument {
  displayName: string;
  createdAt: string;
  basics: [string, string][];
  skillGroups: CategorizedSkills[];
  qualifications: string[];
  specialty: string | null;
  pr: string[];
  experiences: {
    no: number;
    period: string;
    duration: string;
    title: string;
    industry: string;
    overview: string;
    tasks: string;
    role: string;
    teamSize: string;
    env: { label: string; value: string }[];
    phases: boolean[];
  }[];
  phaseHeaders: string[];
}

export const displayNameOf = (s: Pick<SkillSheetSource, "name" | "initials" | "showFullName">) =>
  !s.showFullName && s.initials?.trim() ? s.initials.trim() : s.name;

export function experienceYears(s: Pick<SkillSheetSource, "totalExperienceYears" | "experiences">, now = new Date()): number | null {
  if (s.totalExperienceYears) return s.totalExperienceYears;
  const months = totalExperienceMonths(s.experiences, now);
  return months ? Math.round((months / 12) * 10) / 10 : null;
}

export function buildSkillSheetDocument(s: SkillSheetSource, now = new Date()): SkillSheetDocument {
  const exps = sortExperiences(s.experiences.filter((e) => e.title.trim()));
  const years = experienceYears({ ...s, experiences: exps }, now);
  return {
    displayName: displayNameOf(s),
    createdAt: new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" }).format(now),
    basics: [
      ["氏名", displayNameOf(s)],
      ["年齢・性別", [s.age ? `${s.age}歳` : "", s.gender && s.gender !== "回答しない" ? s.gender : ""].filter(Boolean).join("・") || "—"],
      ["最寄駅・勤務形態", s.nearestStation || "—"],
      ["稼働開始", s.availability || "応相談"],
      ["IT経験年数", years ? `約${Math.round(years)}年` : "—"],
      ["得意分野", s.specialty || phaseRangeLabel(phasesUnion(exps)) || "—"],
    ],
    skillGroups: groupSkillsByCategory(s.skills),
    qualifications: s.qualifications.filter((q) => q.name.trim()).map((q) => (q.acquired ? `${q.name}（${q.acquired.replace("-", "年")}月）` : q.name)),
    specialty: s.specialty,
    pr: [...s.appealPoints.filter((p) => p.trim()), ...(s.remarks?.trim() ? [s.remarks.trim()] : [])],
    experiences: exps.map((e, i) => ({
      no: i + 1,
      period: periodLabel(e),
      duration: durationLabel(monthsOf(e, now)),
      title: e.title,
      industry: e.industry,
      overview: e.overview,
      tasks: e.tasks,
      role: e.role,
      teamSize: e.teamSize ? `${e.teamSize}名` : "",
      env: ENV_FIELDS.map((f) => ({ label: f.label, value: e[f.key] })).filter((x) => x.value.trim()),
      phases: PHASES.map((p) => e.phases.includes(p)),
    })),
    phaseHeaders: PHASES.map((p) => PHASE_SHORT[p]),
  };
}

// ---------- サマリーシート（営業・エージェントに送る要員紹介の文面） ----------
// SESの要員紹介メールで一般的な【項目】形式。コピーしてそのままメール・チャットに貼れる
export function generateSummary(s: SkillSheetSource, now = new Date()): string {
  const exps = sortExperiences(s.experiences.filter((e) => e.title.trim()));
  const years = experienceYears({ ...s, experiences: exps }, now);
  const groups = groupSkillsByCategory(s.skills);
  const lines: string[] = [];
  const profile = [s.age ? `${s.age}歳` : "", s.gender && s.gender !== "回答しない" ? s.gender : ""].filter(Boolean).join("・");
  lines.push(`【氏名】${displayNameOf(s)}${profile ? `（${profile}）` : ""}`);
  if (s.nearestStation) lines.push(`【最寄駅】${s.nearestStation}`);
  lines.push(`【稼働開始】${s.availability || "応相談"}`);
  lines.push(`【希望単価】${s.desiredRate ? `${Math.round(s.desiredRate / 10_000)}万円〜（税抜・月額）` : "応相談"}`);
  if (years) lines.push(`【IT経験】約${Math.round(years)}年`);
  const phases = phaseRangeLabel(phasesUnion(exps));
  if (s.specialty) lines.push(`【得意分野】${s.specialty}`);
  if (phases) lines.push(`【対応工程】${phases}`);
  if (groups.length > 0) {
    lines.push("【スキル】");
    for (const g of groups) lines.push(`・${g.category}：${g.skills.map((k) => `${k.name}${k.years ? `（${k.years}年）` : ""}`).join("、")}`);
  }
  const quals = s.qualifications.filter((q) => q.name.trim());
  if (quals.length > 0) lines.push(`【資格】${quals.map((q) => q.name).join("、")}`);
  if (exps.length > 0) {
    lines.push("【直近の経歴】");
    for (const e of exps.slice(0, 3)) {
      const meta = [e.role, e.teamSize ? `${e.teamSize}名` : "", phaseRangeLabel(e.phases)].filter(Boolean).join("／");
      lines.push(`・${periodLabel(e)}（${durationLabel(monthsOf(e, now))}） ${e.title}${meta ? `［${meta}］` : ""}`);
      const env = [e.languages, e.frameworks, e.databases, e.cloud].filter((x) => x.trim()).join(", ");
      if (env) lines.push(`　環境：${env}`);
      const task = (e.tasks || e.overview).split("\n")[0];
      if (task) lines.push(`　${task}`);
    }
  }
  const pr = s.appealPoints.filter((p) => p.trim());
  if (pr.length > 0) {
    lines.push("【アピールポイント】");
    for (const p of pr) lines.push(`・${p}`);
  }
  if (s.remarks?.trim()) lines.push(`【備考】${s.remarks.trim()}`);
  return lines.join("\n");
}

// ---------- 埋まり具合（紹介に出せる状態かの目安） ----------
export function completeness(s: SkillSheetSource) {
  const exps = s.experiences.filter((e) => e.title.trim());
  const checks = [
    { key: "basic", label: "基本情報（年齢・最寄駅・稼働開始）", done: !!(s.age && s.nearestStation && s.availability) },
    { key: "initials", label: "イニシャル（紹介用の表記）", done: !!s.initials?.trim() || s.showFullName },
    { key: "skills", label: "スキル3つ以上", done: s.skills.filter((k) => k.name.trim()).length >= 3 },
    { key: "experiences", label: "経歴（期間・役割・工程・担当業務）", done: exps.length > 0 && exps.every((e) => e.startMonth && e.role && e.phases.length > 0 && e.tasks.trim()) },
    { key: "pr", label: "アピールポイント", done: s.appealPoints.some((p) => p.trim()) },
  ];
  return { checks, done: checks.filter((c) => c.done).length, total: checks.length };
}
