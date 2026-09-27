import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import { publicUser, WORK_STYLES } from "../lib/publicUser";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { deleteUserData } from "../lib/deleteUser";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(50),
  workStyle: z.enum(WORK_STYLES).default("freelance"),
  interests: z.array(z.enum(["health", "study", "money", "career"])).default([]),
  // 部活ページから来た場合はそのまま入部させる（PLG: 登録＝部活への参加券）
  clubSlug: z.string().optional(),
  eventId: z.string().optional(),
  // 招待リンク（?ref=会員ID）から来た場合
  referrerId: z.string().optional(),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "入力内容を確認してください", details: parsed.error.flatten() });
  }
  const { email, password, name, workStyle, interests, clubSlug, eventId, referrerId } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "このメールアドレスは既に登録されています" });
  }

  // 準備中の部活には入部させない（流入元としては記録する）
  const sourceClub = clubSlug ? await prisma.club.findUnique({ where: { slug: clubSlug } }) : null;
  const club = sourceClub?.status === "open" ? sourceClub : null;
  const referrer = referrerId ? await prisma.user.findUnique({ where: { id: referrerId } }) : null;
  const signupSource = referrer ? "referral" : sourceClub ? `club:${sourceClub.slug}` : eventId ? "event" : null;

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      workStyle,
      interests: JSON.stringify(interests),
      signupSource,
      referredById: referrer?.id ?? null,
      ...(club ? { clubMemberships: { create: { clubId: club.id } } } : {}),
    },
  });

  const token = signToken({ userId: user.id });
  res.status(201).json({ token, user: publicUser(user), joinedClub: club?.name ?? null });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "入力内容を確認してください" });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "メールアドレスまたはパスワードが違います" });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "メールアドレスまたはパスワードが違います" });
  }

  const token = signToken({ userId: user.id });
  res.json({ token, user: publicUser(user) });
});

const passwordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(100) });

// パスワードの変更（いまのパスワードで本人確認する）
authRouter.post("/password", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "新しいパスワードは8文字以上にしてください" });
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "ユーザーが見つかりません" });
  if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    return res.status(401).json({ error: "いまのパスワードが違います" });
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10) } });
  res.json({ ok: true });
});

// 退会: 本人のデータをすべて消す（単価診断の申告は、個人と結びつかない形で比較データに残す）
authRouter.delete("/me", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = z.object({ password: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "パスワードを入力してください" });
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "ユーザーが見つかりません" });
  if (user.role === "admin") return res.status(400).json({ error: "運営アカウントは画面から退会できません" });
  if (!(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "パスワードが違います" });
  }

  await deleteUserData(user.id);
  res.status(204).end();
});
