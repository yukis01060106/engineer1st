import { Project } from "@prisma/client";

// 簡易AIレコメンド（モック）: 保有スキルとのマッチ度でスコアリングする
export function scoreProjectsBySkills<T extends Project>(
  projects: T[],
  userSkillNames: string[]
): (T & { matchScore: number })[] {
  const userSkills = userSkillNames.map((s) => s.toLowerCase());

  const scored = projects.map((p) => {
    const projectSkills = p.skills.split(",").map((s) => s.trim().toLowerCase());
    const matchCount = projectSkills.filter((s) => userSkills.includes(s)).length;
    const score = userSkills.length > 0 ? Math.round((matchCount / projectSkills.length) * 100) : 50;
    return { ...p, matchScore: score };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);
  return scored;
}
