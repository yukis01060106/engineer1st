import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const mentorRouter = Router();

mentorRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const requests = await prisma.mentorRequest.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
  });
  res.json({ requests });
});

const schema = z.object({ topic: z.string().min(1), message: z.string().min(1) });

mentorRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容を確認してください" });

  const request = await prisma.mentorRequest.create({
    data: { userId: req.userId!, topic: parsed.data.topic, message: parsed.data.message },
  });
  res.status(201).json({ request });
});
