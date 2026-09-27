import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { computeSkillGaps } from "../lib/skillGap";

export const skillGapRouter = Router();

// スキルギャップ可視化: 自分の保有スキルレベル vs 市場需要
skillGapRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const sheet = await prisma.skillSheet.findUnique({ where: { userId: req.userId! } });
  const mySkills: { name: string; level: number }[] = sheet ? JSON.parse(sheet.skills) : [];
  res.json({ gaps: computeSkillGaps(mySkills) });
});
