import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { buildAutoItems, TASK_KINDS } from "../lib/planner";

export const plannerRouter = Router();

// 本人の予定・ToDoと、エンジニア・ガレージ内の予定（申込済みの勉強会・入金期日・契約終了）をまとめて返す
plannerRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const [tasks, applications, invoices, currentEngagement] = await Promise.all([
    prisma.task.findMany({ where: { userId }, orderBy: [{ date: "asc" }, { time: "asc" }, { createdAt: "asc" }] }),
    prisma.eventApplication.findMany({ where: { userId }, include: { event: true } }),
    prisma.invoice.findMany({ where: { engagement: { userId }, paidAt: null }, include: { engagement: { include: { project: true } } } }),
    prisma.engagement.findFirst({ where: { userId, status: "稼働中" }, include: { project: true } }),
  ]);

  const auto = buildAutoItems({
    now: new Date(),
    appliedEvents: applications.map((a) => ({ id: a.event.id, title: a.event.title, date: a.event.date })),
    unpaidInvoices: invoices.map((i) => ({ id: i.id, targetMonth: i.targetMonth, dueDate: i.dueDate, paidAt: i.paidAt, client: i.engagement.project.client })),
    currentEngagement,
  });
  res.json({ tasks, auto });
});

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}$/);

const createSchema = z.object({
  title: z.string().trim().min(1).max(100),
  kind: z.enum(TASK_KINDS).default("todo"),
  date: date.nullable().optional(),
  time: time.nullable().optional(),
  memo: z.string().max(1000).nullable().optional(),
});

plannerRouter.post("/tasks", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容を確認してください" });
  const b = parsed.data;
  if (b.kind === "event" && !b.date) return res.status(400).json({ error: "予定には日付を入れてください" });
  const task = await prisma.task.create({
    data: { userId: req.userId!, title: b.title, kind: b.kind, date: b.date ?? null, time: b.time ?? null, memo: b.memo ?? null },
  });
  res.status(201).json({ task });
});

const updateSchema = createSchema.partial().extend({ done: z.boolean().optional() });

plannerRouter.patch("/tasks/:id", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容を確認してください" });
  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!task || task.userId !== req.userId) return res.status(404).json({ error: "見つかりません" });

  const { done, ...rest } = parsed.data;
  const updated = await prisma.task.update({
    where: { id: task.id },
    data: { ...rest, ...(done === undefined ? {} : { doneAt: done ? new Date() : null }) },
  });
  res.json({ task: updated });
});

plannerRouter.delete("/tasks/:id", requireAuth, async (req: AuthedRequest, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!task || task.userId !== req.userId) return res.status(404).json({ error: "見つかりません" });
  await prisma.task.delete({ where: { id: task.id } });
  res.status(204).end();
});
