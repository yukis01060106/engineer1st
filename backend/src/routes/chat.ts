import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const chatRouter = Router();

// 担当者チャット（プロトタイプ: メッセージ履歴はメモリ保持、返信は自動応答モック）
interface ChatMessage {
  id: string;
  from: "user" | "staff";
  text: string;
  createdAt: string;
}

const threads = new Map<string, ChatMessage[]>();

function seedThread(userId: string): ChatMessage[] {
  return [
    {
      id: "m0",
      from: "staff",
      text: "担当のエンジニア1stサポートです。案件やキャリアのご相談、何でもお聞かせください。",
      createdAt: new Date().toISOString(),
    },
  ];
}

chatRouter.get("/", requireAuth, (req: AuthedRequest, res) => {
  const userId = req.userId!;
  if (!threads.has(userId)) threads.set(userId, seedThread(userId));
  res.json({ messages: threads.get(userId) });
});

const schema = z.object({ text: z.string().min(1) });

chatRouter.post("/", requireAuth, (req: AuthedRequest, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "メッセージを入力してください" });

  const userId = req.userId!;
  if (!threads.has(userId)) threads.set(userId, seedThread(userId));
  const messages = threads.get(userId)!;

  const userMsg: ChatMessage = {
    id: `m${messages.length}`,
    from: "user",
    text: parsed.data.text,
    createdAt: new Date().toISOString(),
  };
  messages.push(userMsg);

  const staffMsg: ChatMessage = {
    id: `m${messages.length}`,
    from: "staff",
    text: "ご連絡ありがとうございます。内容を確認し、担当より折り返しご連絡します（自動応答のプロトタイプです）。",
    createdAt: new Date().toISOString(),
  };
  messages.push(staffMsg);

  res.status(201).json({ messages });
});
