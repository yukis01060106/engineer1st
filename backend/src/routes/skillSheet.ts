import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { generateSummary } from "../lib/skillSummary";
import { streamSkillSheetExcel } from "../lib/skillSheetExcel";

export const skillSheetRouter = Router();

const skillItem = z.object({ name: z.string(), level: z.number().min(1).max(5), years: z.number().min(0) });
const experienceItem = z.object({
  title: z.string(),
  period: z.string(),
  role: z.string(),
  tech: z.string(),
  description: z.string(),
});

const upsertSchema = z.object({
  skills: z.array(skillItem),
  experiences: z.array(experienceItem),
  age: z.number().min(16).max(90).nullable().optional(),
  nearestStation: z.string().max(100).nullable().optional(),
  availability: z.string().max(50).nullable().optional(),
  desiredRate: z.number().positive().nullable().optional(),
  totalExperienceYears: z.number().min(0).max(60).nullable().optional(),
  workProcesses: z.array(z.string()).optional(),
  appealPoints: z.array(z.string()).optional(),
  remarks: z.string().max(2000).nullable().optional(),
});

function parseSkillSheet(sheet: {
  skills: string;
  experiences: string;
  workProcesses: string | null;
  appealPoints: string | null;
}) {
  return {
    skills: JSON.parse(sheet.skills) as { name: string; level: number; years: number }[],
    experiences: JSON.parse(sheet.experiences) as {
      title: string;
      period: string;
      role: string;
      tech: string;
      description: string;
    }[],
    workProcesses: sheet.workProcesses ? (JSON.parse(sheet.workProcesses) as string[]) : [],
    appealPoints: sheet.appealPoints ? (JSON.parse(sheet.appealPoints) as string[]) : [],
  };
}

skillSheetRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const sheet = await prisma.skillSheet.findUnique({ where: { userId: req.userId! } });
  if (!sheet) return res.json({ skillSheet: null });
  const parsed = parseSkillSheet(sheet);
  res.json({ skillSheet: { ...sheet, ...parsed } });
});

// 新規作成前のスマートデフォルト（登録済みの稼働情報から、ヒアリング不要な項目を自動推定する）
skillSheetRouter.get("/defaults", requireAuth, async (req: AuthedRequest, res) => {
  const [currentEngagement, existingSheet] = await Promise.all([
    prisma.engagement.findFirst({ where: { userId: req.userId!, status: "稼働中" } }),
    prisma.skillSheet.findUnique({ where: { userId: req.userId! } }),
  ]);

  const desiredRate = currentEngagement?.monthlyRate ?? null;
  const availability = currentEngagement?.endDate
    ? `${currentEngagement.endDate.toISOString().slice(0, 10)}以降（応相談）`
    : "即日";

  let totalExperienceYears: number | null = null;
  if (existingSheet) {
    const { skills } = parseSkillSheet(existingSheet);
    totalExperienceYears = skills.length > 0 ? Math.max(...skills.map((s) => s.years)) : null;
  }

  res.json({ defaults: { desiredRate, availability, totalExperienceYears } });
});

// スキルシート（構造化データ）の保存 + サマリーシート（文章）の自動生成
skillSheetRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "入力内容を確認してください", details: parsed.error.flatten() });
  }
  const {
    skills,
    experiences,
    age,
    nearestStation,
    availability,
    desiredRate,
    workProcesses = [],
    appealPoints = [],
    remarks,
  } = parsed.data;

  // IT経験年数は入力がなければ保有スキルの最大経験年数から自動算出
  const totalExperienceYears =
    parsed.data.totalExperienceYears ?? (skills.length > 0 ? Math.max(...skills.map((s) => s.years)) : null);

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });

  const summary = generateSummary({
    name: user?.name ?? "",
    age,
    nearestStation,
    availability,
    desiredRate,
    totalExperienceYears,
    workProcesses,
    appealPoints,
    remarks,
    skills,
    experiences,
  });

  const data = {
    skills: JSON.stringify(skills),
    experiences: JSON.stringify(experiences),
    age: age ?? null,
    nearestStation: nearestStation ?? null,
    availability: availability ?? null,
    desiredRate: desiredRate ?? null,
    totalExperienceYears,
    workProcesses: JSON.stringify(workProcesses),
    appealPoints: JSON.stringify(appealPoints),
    remarks: remarks ?? null,
    summary,
  };

  const sheet = await prisma.skillSheet.upsert({
    where: { userId: req.userId! },
    update: data,
    create: { userId: req.userId!, ...data },
  });

  res.json({ skillSheet: { ...sheet, skills, experiences, workProcesses, appealPoints } });
});

// スキルシート（Excel）のダウンロード
skillSheetRouter.get("/excel", requireAuth, async (req: AuthedRequest, res) => {
  const [sheet, user] = await Promise.all([
    prisma.skillSheet.findUnique({ where: { userId: req.userId! } }),
    prisma.user.findUnique({ where: { id: req.userId! } }),
  ]);
  if (!sheet || !user) {
    return res.status(404).json({ error: "スキルシートが未作成です" });
  }
  const { skills, experiences, workProcesses, appealPoints } = parseSkillSheet(sheet);

  await streamSkillSheetExcel(res, {
    name: user.name,
    age: sheet.age,
    nearestStation: sheet.nearestStation,
    availability: sheet.availability,
    desiredRate: sheet.desiredRate,
    totalExperienceYears: sheet.totalExperienceYears,
    workProcesses,
    appealPoints,
    remarks: sheet.remarks,
    skills,
    experiences,
  });
});
