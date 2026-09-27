import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, optionalAuth, AuthedRequest } from "../middleware/auth";
import { diagnoseRate, EXPERIENCE_BAND } from "../lib/rateDiagnosis";

export const rateDiagnosisRouter = Router();

const submitSchema = z.object({
  primarySkill: z.string().min(1),
  role: z.string().min(1),
  yearsOfExperience: z.number().min(0).max(50),
  monthlyRate: z.number().positive(),
  chainDepth: z.number().min(1).max(10).optional(),
});

rateDiagnosisRouter.post("/", optionalAuth, async (req: AuthedRequest, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "入力内容を確認してください", details: parsed.error.flatten() });
  }
  const { primarySkill, role, yearsOfExperience, monthlyRate, chainDepth } = parsed.data;

  // 似た条件（役割・主要スキル・経験年数±2年）の自己申告データを集計
  const similar = await prisma.rateDiagnosis.findMany({
    where: {
      role,
      primarySkill,
      yearsOfExperience: { gte: yearsOfExperience - EXPERIENCE_BAND, lte: yearsOfExperience + EXPERIENCE_BAND },
    },
    select: { monthlyRate: true },
  });

  const result = diagnoseRate(parsed.data, similar.map((s) => s.monthlyRate));

  await prisma.rateDiagnosis.create({
    data: {
      userId: req.userId ?? null,
      primarySkill,
      role,
      yearsOfExperience,
      monthlyRate,
      chainDepth,
    },
  });

  res.status(201).json({ result });
});

rateDiagnosisRouter.get("/mine", requireAuth, async (req: AuthedRequest, res) => {
  const diagnoses = await prisma.rateDiagnosis.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
  });
  res.json({ diagnoses });
});
