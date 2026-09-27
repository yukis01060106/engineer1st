import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, optionalAuth, AuthedRequest } from "../middleware/auth";

export const clubsRouter = Router();

// 部活一覧（公開）。ログインしていれば入部状況も返す
clubsRouter.get("/", optionalAuth, async (req: AuthedRequest, res) => {
  const now = new Date();
  const clubs = await prisma.club.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { memberships: true } },
      events: { where: { date: { gte: now } }, orderBy: { date: "asc" }, take: 1 },
      memberships: req.userId ? { where: { userId: req.userId }, select: { id: true } } : false,
    },
  });
  res.json({
    clubs: clubs.map(({ memberships, events, _count, ...c }) => ({
      ...c,
      memberCount: _count.memberships,
      nextActivity: events[0] ? { id: events[0].id, title: events[0].title, date: events[0].date, location: events[0].location } : null,
      joined: Array.isArray(memberships) && memberships.length > 0,
    })),
  });
});

clubsRouter.get("/:slug", optionalAuth, async (req: AuthedRequest, res) => {
  const club = await prisma.club.findUnique({
    where: { slug: req.params.slug },
    include: {
      _count: { select: { memberships: true } },
      events: { where: { date: { gte: new Date() } }, orderBy: { date: "asc" }, take: 5 },
    },
  });
  if (!club) return res.status(404).json({ error: "部活が見つかりません" });
  const joined = req.userId
    ? !!(await prisma.clubMembership.findUnique({ where: { userId_clubId: { userId: req.userId, clubId: club.id } } }))
    : false;
  const { _count, ...rest } = club;
  res.json({ club: { ...rest, memberCount: _count.memberships, joined } });
});

clubsRouter.post("/:slug/join", requireAuth, async (req: AuthedRequest, res) => {
  const club = await prisma.club.findUnique({ where: { slug: req.params.slug } });
  if (!club) return res.status(404).json({ error: "部活が見つかりません" });
  await prisma.clubMembership.upsert({
    where: { userId_clubId: { userId: req.userId!, clubId: club.id } },
    update: {},
    create: { userId: req.userId!, clubId: club.id },
  });
  res.status(201).json({ joined: true });
});

clubsRouter.delete("/:slug/join", requireAuth, async (req: AuthedRequest, res) => {
  const club = await prisma.club.findUnique({ where: { slug: req.params.slug } });
  if (!club) return res.status(404).json({ error: "部活が見つかりません" });
  await prisma.clubMembership.deleteMany({ where: { userId: req.userId!, clubId: club.id } });
  res.json({ joined: false });
});
