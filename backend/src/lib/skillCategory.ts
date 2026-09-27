// スキル名からカテゴリを推定する（スキルシートの「■ スキルサマリー」欄の自動分類に使用）

export type SkillCategory =
  | "フロントエンド"
  | "バックエンド"
  | "DB"
  | "インフラ・環境"
  | "OS"
  | "パッケージ"
  | "その他";

const CATEGORY_KEYWORDS: Record<SkillCategory, string[]> = {
  フロントエンド: [
    "react", "vue", "angular", "typescript", "javascript", "html", "css", "next.js", "nuxt", "svelte",
  ],
  バックエンド: [
    "node.js", "java", "spring", "c#", "php", "c++", "python", "ruby", "go", "fastify", "asp.net", "django", "rails", ".net",
  ],
  DB: [
    "postgresql", "mysql", "azure sql", "cloud sql", "sql server", "mariadb", "mongodb", "oracle", "dynamodb", "redis",
  ],
  "インフラ・環境": [
    "gcp", "aws", "azure", "docker", "kubernetes", "terraform", "ansible", "jenkins", "github actions", "gitlab ci",
  ],
  OS: ["windows", "linux", "mac", "unix", "ms-dos"],
  パッケージ: ["wordpress", "salesforce", "sap", "shopify"],
  その他: [],
};

export function categorizeSkill(skillName: string): SkillCategory {
  const lower = skillName.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [SkillCategory, string[]][]) {
    if (keywords.some((k) => lower.includes(k))) {
      return category;
    }
  }
  return "その他";
}

export interface CategorizedSkills {
  category: SkillCategory;
  skills: { name: string; level: number; years: number; strong: boolean }[];
}

const CATEGORY_ORDER: SkillCategory[] = [
  "フロントエンド",
  "バックエンド",
  "DB",
  "インフラ・環境",
  "OS",
  "パッケージ",
  "その他",
];

export function groupSkillsByCategory(
  skills: { name: string; level: number; years: number }[]
): CategorizedSkills[] {
  const groups = new Map<SkillCategory, CategorizedSkills["skills"]>();

  for (const skill of skills) {
    const category = categorizeSkill(skill.name);
    const list = groups.get(category) ?? [];
    list.push({ ...skill, strong: skill.level >= 4 });
    groups.set(category, list);
  }

  return CATEGORY_ORDER.filter((c) => groups.has(c)).map((category) => ({
    category,
    skills: groups.get(category)!,
  }));
}
