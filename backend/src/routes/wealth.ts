import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { buildFinancialSnapshot } from "../lib/fpContext";
import { answerFp } from "../lib/aiFp";

export const wealthRouter = Router();

wealthRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const snapshot = await buildFinancialSnapshot(req.userId!);
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  res.json({ snapshot, birthYear: user?.birthYear ?? null });
});

const planSchema = z.object({
  birthYear: z.number().int().min(1940).max(2010).optional(),
  monthlyLivingCost: z.number().int().min(0).max(10_000_000),
  cashSavings: z.number().int().min(0).max(10_000_000_000),
  investedAssets: z.number().int().min(0).max(10_000_000_000),
  kyosaiMonthly: z.number().int().min(0).max(70_000),
  idecoMonthly: z.number().int().min(0).max(68_000),
  nisaMonthly: z.number().int().min(0).max(300_000),
  expectedReturn: z.number().min(0).max(0.1),
  retireAge: z.number().int().min(40).max(90),
  annualSalary: z.number().int().min(0).max(100_000_000).nullable().optional(),
});

wealthRouter.put("/plan", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容を確認してください", details: parsed.error.flatten() });
  const { birthYear, ...plan } = parsed.data;
  if (birthYear) await prisma.user.update({ where: { id: req.userId! }, data: { birthYear } });
  await prisma.wealthPlan.upsert({
    where: { userId: req.userId! },
    update: plan,
    create: { userId: req.userId!, ...plan },
  });
  const snapshot = await buildFinancialSnapshot(req.userId!);
  res.json({ snapshot });
});

wealthRouter.get("/fp", requireAuth, async (req: AuthedRequest, res) => {
  const messages = await prisma.fpMessage.findMany({ where: { userId: req.userId! }, orderBy: { createdAt: "asc" }, take: 100 });
  res.json({ messages, claudeEnabled: !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) });
});

const askSchema = z.object({ question: z.string().min(1).max(1000) });

wealthRouter.post("/fp", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = askSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "質問を入力してください" });

  const [snapshot, history] = await Promise.all([
    buildFinancialSnapshot(req.userId!),
    prisma.fpMessage.findMany({ where: { userId: req.userId! }, orderBy: { createdAt: "asc" }, take: 20 }),
  ]);
  const answer = await answerFp(
    snapshot,
    history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    parsed.data.question
  );

  await prisma.fpMessage.create({ data: { userId: req.userId!, role: "user", content: parsed.data.question } });
  const reply = await prisma.fpMessage.create({ data: { userId: req.userId!, role: "assistant", content: answer.text } });
  res.status(201).json({ reply, source: answer.source });
});

wealthRouter.delete("/fp", requireAuth, async (req: AuthedRequest, res) => {
  await prisma.fpMessage.deleteMany({ where: { userId: req.userId! } });
  res.json({ ok: true });
});
