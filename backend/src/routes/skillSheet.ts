import { Router } from "express";
import { z } from "zod";
import { SkillSheet, User } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { jstDate } from "../lib/planner";
import {
  PHASES,
  normalizeExperience,
  generateSummary,
  buildSkillSheetDocument,
  phasesUnion,
  totalExperienceMonths,
  completeness,
  SkillSheetSource,
  Experience,
} from "../lib/skillSheet";
import { streamSkillSheetExcel } from "../lib/skillSheetExcel";

export const skillSheetRouter = Router();

const ym = z.string().regex(/^\d{4}-\d{2}$/);
const skillItem = z.object({ name: z.string().trim().min(1).max(40), level: z.number().int().min(1).max(5), years: z.number().min(0).max(50) });
const envText = z.string().max(300).default("");
const experienceItem = z.object({
  title: z.string().trim().min(1).max(100),
  industry: z.string().max(40).default(""),
  startMonth: ym,
  endMonth: ym.nullable(),
  overview: z.string().max(1000).default(""),
  tasks: z.string().max(2000).default(""),
  role: z.string().max(40).default(""),
  teamSize: z.number().int().min(1).max(10000).nullable().default(null),
  phases: z.array(z.enum(PHASES)).default([]),
  languages: envText,
  frameworks: envText,
  databases: envText,
  os: envText,
  cloud: envText,
  tools: envText,
});

const upsertSchema = z.object({
  skills: z.array(skillItem).max(60),
  experiences: z.array(experienceItem).max(40),
  age: z.number().int().min(16).max(90).nullable().optional(),
  gender: z.enum(["男性", "女性", "回答しない"]).nullable().optional(),
  initials: z.string().trim().max(20).nullable().optional(),
  showFullName: z.boolean().optional(),
  nearestStation: z.string().max(100).nullable().optional(),
  availability: z.string().max(50).nullable().optional(),
  desiredRate: z.number().int().positive().nullable().optional(),
  totalExperienceYears: z.number().min(0).max(60).nullable().optional(),
  specialty: z.string().max(200).nullable().optional(),
  qualifications: z.array(z.object({ name: z.string().trim().max(100), acquired: z.string().regex(/^(\d{4}-\d{2})?$/).default("") })).max(30).default([]),
  appealPoints: z.array(z.string().max(300)).max(10).default([]),
  remarks: z.string().max(2000).nullable().optional(),
});

// DBの行（JSON文字列）を、画面・Excel・サマリーで使う形にする
export function sourceOf(sheet: SkillSheet, user: Pick<User, "name">): SkillSheetSource {
  const parse = <T,>(json: string | null, fallback: T): T => {
    try {
      return json ? (JSON.parse(json) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    name: user.name,
    initials: sheet.initials,
    showFullName: sheet.showFullName,
    age: sheet.age,
    gender: sheet.gender,
    nearestStation: sheet.nearestStation,
    availability: sheet.availability,
    desiredRate: sheet.desiredRate,
    totalExperienceYears: sheet.totalExperienceYears,
    specialty: sheet.specialty,
    qualifications: parse(sheet.qualifications, []),
    appealPoints: parse(sheet.appealPoints, []),
    remarks: sheet.remarks,
    skills: parse(sheet.skills, []),
    experiences: parse<Record<string, unknown>[]>(sheet.experiences, []).map(normalizeExperience),
  };
}

async function load(userId: string) {
  const [sheet, user] = await Promise.all([prisma.skillSheet.findUnique({ where: { userId } }), prisma.user.findUnique({ where: { id: userId } })]);
  return { sheet, user };
}

skillSheetRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const { sheet, user } = await load(req.userId!);
  if (!sheet || !user) return res.json({ skillSheet: null });
  const source = sourceOf(sheet, user);
  res.json({ skillSheet: { ...source, summary: sheet.summary, updatedAt: sheet.updatedAt, completeness: completeness(source) } });
});

// 新規作成前のスマートデフォルト（登録済みの稼働情報から、ヒアリング不要な項目を自動推定する）
skillSheetRouter.get("/defaults", requireAuth, async (req: AuthedRequest, res) => {
  const current = await prisma.engagement.findFirst({ where: { userId: req.userId!, status: "稼働中" }, include: { project: true } });
  const experience: Experience | null = current
    ? normalizeExperience({ title: current.project.title, startMonth: jstDate(current.startDate).slice(0, 7), endMonth: null })
    : null;
  res.json({
    defaults: {
      desiredRate: current?.monthlyRate ?? null,
      availability: current?.endDate ? `${jstDate(current.endDate).slice(0, 7).replace("-", "年")}月〜（応相談）` : "即日",
      experiences: experience ? [experience] : [],
    },
  });
});

// スキルシート（構造化データ）の保存 + サマリーシート（文章）の自動生成
skillSheetRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path[0] === "experiences" ? `経歴${Number(issue.path[1]) + 1}の` : issue?.path[0] === "skills" ? "スキルの" : "";
    return res.status(400).json({ error: `${where}入力内容を確認してください（期間は開始月が必須です）`, details: parsed.error.flatten() });
  }
  const b = parsed.data;
  const bad = b.experiences.findIndex((e) => e.endMonth && e.endMonth < e.startMonth);
  if (bad >= 0) return res.status(400).json({ error: `経歴${bad + 1}の期間は「開始月 ≦ 終了月」で入力してください` });

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(404).json({ error: "ユーザーが見つかりません" });

  const experiences = b.experiences.map((e) => normalizeExperience(e));
  const source: SkillSheetSource = {
    name: user.name,
    initials: b.initials ?? null,
    showFullName: b.showFullName ?? false,
    age: b.age ?? null,
    gender: b.gender ?? null,
    nearestStation: b.nearestStation ?? null,
    availability: b.availability ?? null,
    desiredRate: b.desiredRate ?? null,
    // 入力がなければ経歴の期間から自動計算（重なる期間は1回だけ数える）
    totalExperienceYears: b.totalExperienceYears ?? (Math.round(totalExperienceMonths(experiences) / 12) || null),
    specialty: b.specialty?.trim() || null,
    qualifications: b.qualifications.filter((q) => q.name),
    appealPoints: b.appealPoints.map((p) => p.trim()).filter(Boolean),
    remarks: b.remarks?.trim() || null,
    skills: b.skills,
    experiences,
  };

  const data = {
    skills: JSON.stringify(source.skills),
    experiences: JSON.stringify(source.experiences),
    age: source.age,
    gender: source.gender,
    initials: source.initials,
    showFullName: source.showFullName,
    nearestStation: source.nearestStation,
    availability: source.availability,
    desiredRate: source.desiredRate,
    totalExperienceYears: source.totalExperienceYears,
    specialty: source.specialty,
    qualifications: JSON.stringify(source.qualifications),
    workProcesses: JSON.stringify(phasesUnion(source.experiences)),
    appealPoints: JSON.stringify(source.appealPoints),
    remarks: source.remarks,
    summary: generateSummary(source),
  };

  const sheet = await prisma.skillSheet.upsert({ where: { userId: user.id }, update: data, create: { userId: user.id, ...data } });
  res.json({ skillSheet: { ...source, summary: sheet.summary, updatedAt: sheet.updatedAt, completeness: completeness(source) } });
});

// 印刷用ページ（ブラウザでPDF保存）で使う中身
skillSheetRouter.get("/document", requireAuth, async (req: AuthedRequest, res) => {
  const { sheet, user } = await load(req.userId!);
  res.json({ document: sheet && user ? buildSkillSheetDocument(sourceOf(sheet, user)) : null });
});

// スキルシート（Excel）のダウンロード
skillSheetRouter.get("/excel", requireAuth, async (req: AuthedRequest, res) => {
  const { sheet, user } = await load(req.userId!);
  if (!sheet || !user) return res.status(404).json({ error: "スキルシートが未作成です" });
  await streamSkillSheetExcel(res, buildSkillSheetDocument(sourceOf(sheet, user)));
});
