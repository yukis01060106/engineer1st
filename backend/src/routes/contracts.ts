import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const contractsRouter = Router();

// 契約書一覧
contractsRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const contracts = await prisma.contract.findMany({
    where: { engagement: { userId: req.userId! } },
    include: { engagement: { include: { project: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ contracts });
});

contractsRouter.get("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const contract = await prisma.contract.findUnique({
    where: { id: req.params.id },
    include: { engagement: { include: { project: true } } },
  });
  if (!contract || contract.engagement.userId !== req.userId) {
    return res.status(404).json({ error: "契約書が見つかりません" });
  }
  res.json({ contract });
});

const signSchema = z.object({ signedName: z.string().min(1) });

// 電子締結（プロトタイプにつき簡易的な同意記録。氏名入力＝サインとみなす）
contractsRouter.post("/:id/sign", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = signSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "氏名を入力してください" });
  }

  const contract = await prisma.contract.findUnique({
    where: { id: req.params.id },
    include: { engagement: true },
  });
  if (!contract || contract.engagement.userId !== req.userId) {
    return res.status(404).json({ error: "契約書が見つかりません" });
  }
  if (contract.status === "締結済み") {
    return res.status(400).json({ error: "既に締結済みです" });
  }

  const updated = await prisma.contract.update({
    where: { id: contract.id },
    data: { status: "締結済み", signedAt: new Date(), signedName: parsed.data.signedName },
  });

  res.json({ contract: updated });
});
