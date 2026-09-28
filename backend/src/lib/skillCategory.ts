// スキル名から分類を推定する（スキルシートの「スキル要約」欄の自動分類に使用）
// 分類はSESのスキルシートで一般的な「言語／フレームワーク／DB／OS／クラウド・インフラ／ツール」にそろえる

export type SkillCategory = "言語" | "フレームワーク" | "DB" | "OS" | "クラウド・インフラ" | "ツール・その他";

export const CATEGORY_ORDER: SkillCategory[] = ["言語", "フレームワーク", "DB", "OS", "クラウド・インフラ", "ツール・その他"];

// 完全一致で判定する（"Java" と "JavaScript" のような取り違えを防ぐ）
const EXACT: Record<string, SkillCategory> = {};
const add = (c: SkillCategory, names: string[]) => names.forEach((n) => (EXACT[n.toLowerCase()] = c));
add("言語", [
  "typescript", "javascript", "java", "python", "go", "golang", "ruby", "php", "c", "c++", "c#", "kotlin", "swift", "scala", "rust",
  "dart", "r", "vba", "cobol", "perl", "shell", "bash", "sql", "html", "css", "sass", "objective-c", "elixir",
]);
add("フレームワーク", [
  "react", "next.js", "vue", "vue.js", "nuxt", "nuxt.js", "angular", "svelte", "node.js", "express", "nestjs", "fastify", "spring",
  "spring boot", "django", "flask", "fastapi", "rails", "ruby on rails", "laravel", "cakephp", ".net", "asp.net", "flutter",
  "react native", "jquery", "struts", "tailwind css", "redux", "graphql", "jsp",
]);
add("DB", [
  "postgresql", "mysql", "oracle", "sql server", "sqlite", "mariadb", "mongodb", "dynamodb", "redis", "elasticsearch", "bigquery",
  "firestore", "cloud sql", "aurora", "snowflake",
]);
add("OS", ["linux", "windows", "windows server", "macos", "mac", "unix", "red hat", "rhel", "centos", "ubuntu", "amazon linux"]);
add("クラウド・インフラ", [
  "aws", "gcp", "google cloud", "azure", "docker", "kubernetes", "terraform", "ansible", "nginx", "apache", "vercel", "firebase",
  "github actions", "jenkins", "circleci", "gitlab ci", "cloudformation", "ecs", "lambda",
]);

export function categorizeSkill(skillName: string): SkillCategory {
  return EXACT[skillName.trim().toLowerCase()] ?? "ツール・その他";
}

export interface CategorizedSkills {
  category: SkillCategory;
  skills: { name: string; level: number; years: number; strong: boolean }[];
}

export function groupSkillsByCategory(skills: { name: string; level: number; years: number }[]): CategorizedSkills[] {
  const groups = new Map<SkillCategory, CategorizedSkills["skills"]>();
  for (const skill of skills) {
    if (!skill.name.trim()) continue;
    const category = categorizeSkill(skill.name);
    const list = groups.get(category) ?? [];
    list.push({ ...skill, strong: skill.level >= 4 });
    groups.set(category, list);
  }
  return CATEGORY_ORDER.filter((c) => groups.has(c)).map((category) => ({
    category,
    // 経験年数の長い順
    skills: groups.get(category)!.sort((a, b) => b.years - a.years || b.level - a.level),
  }));
}
