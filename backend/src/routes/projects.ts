import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { scoreProjectsBySkills } from "../lib/recommend";

export const projectsRouter = Router();

// 案件一覧・検索
projectsRouter.get("/", async (req, res) => {
  const { keyword, minPrice } = req.query;

  const where: any = {};
  if (keyword && typeof keyword === "string") {
    where.OR = [
      { title: { contains: keyword } },
      { skills: { contains: keyword } },
      { client: { contains: keyword } },
    ];
  }
  if (minPrice && typeof minPrice === "string") {
    where.unitPrice = { gte: Number(minPrice) };
  }

  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  res.json({ projects });
});

projectsRouter.get("/:id", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: "案件が見つかりません" });
  res.json({ project });
});

// 簡易AIレコメンド（モック）: ユーザーの直近スキルシートとのマッチ度でスコアリング
projectsRouter.get("/recommend/for-me", requireAuth, async (req: AuthedRequest, res) => {
  const skillSheet = await prisma.skillSheet.findUnique({ where: { userId: req.userId! } });
  const projects = await prisma.project.findMany({ orderBy: { createdAt: "desc" } });

  const userSkillNames = skillSheet
    ? (JSON.parse(skillSheet.skills) as { name: string }[]).map((s) => s.name)
    : [];

  const scored = scoreProjectsBySkills(projects, userSkillNames);
  res.json({ recommendations: scored.slice(0, 10) });
});
