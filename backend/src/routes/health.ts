import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const healthRouter = Router();

const CHECKUP_INTERVAL_DAYS = 365;

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 直近14日のコンディションと、健康診断・部活の状況
healthRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const since = new Date();
  since.setDate(since.getDate() - 13);
  const [logs, user, clubs] = await Promise.all([
    prisma.healthLog.findMany({ where: { userId: req.userId!, date: { gte: isoDate(since) } }, orderBy: { date: "asc" } }),
    prisma.user.findUnique({ where: { id: req.userId! } }),
    prisma.clubMembership.findMany({ where: { userId: req.userId! }, include: { club: true } }),
  ]);

  const days: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    days.push(isoDate(d));
  }
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const series = days.map((date) => {
    const l = byDate.get(date);
    return { date, steps: l?.steps ?? null, sleepHours: l?.sleepHours ?? null, exerciseMin: l?.exerciseMin ?? null, mood: l?.mood ?? null };
  });

  const last7 = series.slice(-7);
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null;
  };

  const lastCheckup = user?.lastCheckupDate ?? null;
  const daysSinceCheckup = lastCheckup ? Math.floor((Date.now() - lastCheckup.getTime()) / 86_400_000) : null;

  res.json({
    today: isoDate(new Date()),
    series,
    weekly: {
      steps: avg(last7.map((d) => d.steps)),
      sleepHours: avg(last7.map((d) => d.sleepHours)),
      exerciseMin: last7.reduce((s, d) => s + (d.exerciseMin ?? 0), 0),
      mood: avg(last7.map((d) => d.mood)),
      loggedDays: last7.filter((d) => d.steps != null || d.sleepHours != null || d.mood != null).length,
    },
    checkup: {
      lastDate: lastCheckup,
      daysSince: daysSinceCheckup,
      due: daysSinceCheckup == null || daysSinceCheckup >= CHECKUP_INTERVAL_DAYS,
    },
    clubs: clubs.map((m) => ({ slug: m.club.slug, name: m.club.name, color: m.club.color })),
  });
});

const logSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: z.number().int().min(0).max(100_000).nullable().optional(),
  sleepHours: z.number().min(0).max(24).nullable().optional(),
  exerciseMin: z.number().int().min(0).max(1440).nullable().optional(),
  mood: z.number().int().min(1).max(5).nullable().optional(),
});

healthRouter.put("/logs", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容を確認してください" });
  const { date, ...data } = parsed.data;
  const log = await prisma.healthLog.upsert({
    where: { userId_date: { userId: req.userId!, date } },
    update: data,
    create: { userId: req.userId!, date, ...data },
  });
  res.json({ log });
});

const checkupSchema = z.object({ lastCheckupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

healthRouter.put("/checkup", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = checkupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "日付を確認してください" });
  await prisma.user.update({ where: { id: req.userId! }, data: { lastCheckupDate: new Date(parsed.data.lastCheckupDate) } });
  res.json({ ok: true });
});
