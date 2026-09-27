import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const skillGapRouter = Router();

// 市場で人気の高いスキル（モック集計値）
const MARKET_DEMAND: Record<string, number> = {
  TypeScript: 90,
  React: 88,
  "Next.js": 80,
  AWS: 85,
  Go: 65,
  Python: 82,
  Kubernetes: 70,
  "Node.js": 78,
};

// スキルギャップ可視化: 自分の保有スキルレベル vs 市場需要
skillGapRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const sheet = await prisma.skillSheet.findUnique({ where: { userId: req.userId! } });
  const mySkills: { name: string; level: number }[] = sheet ? JSON.parse(sheet.skills) : [];
  const myMap = new Map(mySkills.map((s) => [s.name, s.level]));

  const gaps = Object.entries(MARKET_DEMAND).map(([name, demand]) => {
    const myLevel = myMap.get(name) ?? 0;
    const myLevelScaled = myLevel * 20; // 1-5 -> 20-100 スケール
    return {
      name,
      marketDemand: demand,
      myLevel: myLevelScaled,
      gap: demand - myLevelScaled,
    };
  });

  gaps.sort((a, b) => b.gap - a.gap);
  res.json({ gaps });
});
