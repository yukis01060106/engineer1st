import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { autoReply, CHAT_WELCOME } from "../lib/chatReply";

export const chatRouter = Router();

// 担当者チャット: 会員が送ると、内容に合わせた受付の自動応答を返す。担当者は運営画面から返信する
export async function chatThread(userId: string) {
  const rows = await prisma.chatMessage.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  const welcome = { id: "welcome", from: "staff", text: CHAT_WELCOME, auto: true, createdAt: rows[0]?.createdAt ?? new Date() };
  return [welcome, ...rows.map((m) => ({ id: m.id, from: m.from, text: m.text, auto: m.auto, createdAt: m.createdAt }))];
}

chatRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  res.json({ messages: await chatThread(req.userId!) });
});

const schema = z.object({ text: z.string().trim().min(1).max(2000) });

chatRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "メッセージを入力してください" });

  const userId = req.userId!;
  const now = Date.now();
  await prisma.chatMessage.create({ data: { userId, from: "user", text: parsed.data.text, createdAt: new Date(now) } });
  await prisma.chatMessage.create({ data: { userId, from: "staff", text: autoReply(parsed.data.text), auto: true, createdAt: new Date(now + 1) } });

  res.status(201).json({ messages: await chatThread(userId) });
});
