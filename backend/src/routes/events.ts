import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireAdmin, optionalAuth, AuthedRequest } from "../middleware/auth";

export const eventsRouter = Router();

// 参加URLは申込者にしか渡さない。一覧・詳細の公開レスポンスからは必ず外す
function publicEvent<T extends { joinUrl: string | null }>(e: T) {
  const { joinUrl, ...rest } = e;
  return { ...rest, hasJoinUrl: !!joinUrl };
}

// 勉強会・部活の活動・交流会の一覧（公開）
eventsRouter.get("/", optionalAuth, async (req: AuthedRequest, res) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const events = await prisma.event.findMany({
    where: { date: { gte: new Date(Date.now() - 86_400_000) }, ...(type ? { type } : {}) },
    orderBy: { date: "asc" },
    include: {
      club: { select: { slug: true, name: true, color: true } },
      _count: { select: { applications: true } },
      applications: req.userId ? { where: { userId: req.userId }, select: { id: true } } : false,
    },
  });
  res.json({
    events: events.map(({ applications, ...e }) => ({
      ...publicEvent(e),
      applied: Array.isArray(applications) && applications.length > 0,
    })),
  });
});

// 自分の申込（参加URLつき）
eventsRouter.get("/my-applications", requireAuth, async (req: AuthedRequest, res) => {
  const applications = await prisma.eventApplication.findMany({
    where: { userId: req.userId! },
    include: { event: { include: { club: { select: { name: true, slug: true } } } } },
    orderBy: { event: { date: "asc" } },
  });
  res.json({ applications });
});

eventsRouter.get("/:id", optionalAuth, async (req: AuthedRequest, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: { club: { select: { slug: true, name: true, color: true } }, _count: { select: { applications: true } } },
  });
  if (!event) return res.status(404).json({ error: "イベントが見つかりません" });
  const application = req.userId
    ? await prisma.eventApplication.findUnique({ where: { userId_eventId: { userId: req.userId, eventId: event.id } } })
    : null;
  res.json({
    event: publicEvent(event),
    application: application ? { ...application, joinUrl: event.joinUrl } : null,
  });
});

const applySchema = z.object({
  purpose: z.string().max(200).optional(),
  level: z.enum(["入門", "実務で少し", "実務でがっつり", "人に教えられる"]).optional(),
  question: z.string().max(500).optional(),
});

// 参加フォームの送信 → 参加URLを発行（その場で返す）
eventsRouter.post("/:id/apply", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = applySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "入力内容を確認してください" });

  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { applications: true } }, club: { select: { status: true } } },
  });
  if (!event) return res.status(404).json({ error: "イベントが見つかりません" });
  if (event.club && event.club.status !== "open") return res.status(409).json({ error: "この部活は準備中です" });
  if (event._count.applications >= event.capacity) return res.status(409).json({ error: "定員に達しました" });

  const existing = await prisma.eventApplication.findUnique({
    where: { userId_eventId: { userId: req.userId!, eventId: event.id } },
  });
  if (existing) return res.status(409).json({ error: "既に申込済みです" });

  // 部活の活動は部員であることが前提。未入部なら申込と同時に入部させる
  if (event.clubId) {
    await prisma.clubMembership.upsert({
      where: { userId_clubId: { userId: req.userId!, clubId: event.clubId } },
      update: {},
      create: { userId: req.userId!, clubId: event.clubId },
    });
  }

  const application = await prisma.eventApplication.create({
    data: { userId: req.userId!, eventId: event.id, ...parsed.data },
  });
  res.status(201).json({ application: { ...application, joinUrl: event.joinUrl } });
});

eventsRouter.delete("/:id/apply", requireAuth, async (req: AuthedRequest, res) => {
  await prisma.eventApplication.deleteMany({ where: { userId: req.userId!, eventId: req.params.id } });
  res.json({ ok: true });
});

function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function icsEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// カレンダー登録用 .ics（申込者のみ・参加URLを含む）
eventsRouter.get("/:id/calendar.ics", requireAuth, async (req: AuthedRequest, res) => {
  const application = await prisma.eventApplication.findUnique({
    where: { userId_eventId: { userId: req.userId!, eventId: req.params.id } },
    include: { event: true },
  });
  if (!application) return res.status(404).json({ error: "申込が見つかりません" });
  const e = application.event;
  const end = new Date(e.date.getTime() + e.durationMin * 60_000);
  const location = e.isOnline && e.joinUrl ? e.joinUrl : e.location;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ENGINEER GARAGE//Events//JA",
    "BEGIN:VEVENT",
    `UID:${e.id}@engineer-garage`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(e.date)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(e.title)}`,
    `LOCATION:${icsEscape(location)}`,
    `DESCRIPTION:${icsEscape(`${e.description}${e.joinUrl ? `\n参加URL: ${e.joinUrl}` : ""}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="event-${e.id}.ics"`);
  res.send(ics);
});

// ---- 運営：勉強会の告知（作成・更新） ----
const eventSchema = z.object({
  title: z.string().min(1).max(100),
  type: z.enum(["勉強会", "部活", "交流会"]),
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)),
  durationMin: z.number().int().min(15).max(600).default(90),
  isOnline: z.boolean().default(true),
  location: z.string().min(1).max(100),
  joinUrl: z.string().url().nullable().optional(),
  speaker: z.string().max(100).nullable().optional(),
  tags: z.string().max(200).default(""),
  description: z.string().min(1).max(2000),
  capacity: z.number().int().min(1).max(10_000).default(50),
  clubId: z.string().nullable().optional(),
});

eventsRouter.post("/", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容を確認してください", details: parsed.error.flatten() });
  const event = await prisma.event.create({ data: { ...parsed.data, date: new Date(parsed.data.date) } });
  res.status(201).json({ event });
});

eventsRouter.patch("/:id", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = eventSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容を確認してください" });
  const { date, ...rest } = parsed.data;
  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: { ...rest, ...(date ? { date: new Date(date) } : {}) },
  });
  res.json({ event });
});

// 申込者と参加フォームの回答（運営のみ）
eventsRouter.get("/:id/applications", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const applications = await prisma.eventApplication.findMany({
    where: { eventId: req.params.id },
    include: { user: { select: { name: true, email: true, workStyle: true } } },
    orderBy: { appliedAt: "asc" },
  });
  res.json({ applications });
});
