import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import {
  calcTax,
  calcSettlement,
  calcWithholding,
  calcDueDate,
  invoiceState,
  nextInvoiceNumber,
  paymentReminderText,
  FREELANCE_ACT_MAX_DAYS,
} from "../lib/invoice";
import { calcTaxReserve } from "../lib/taxReserve";
import { streamBillingPdf } from "../lib/pdf";

export const moneyRouter = Router();

// 稼働（請求先）一覧と精算条件
moneyRouter.get("/engagements", requireAuth, async (req: AuthedRequest, res) => {
  const engagements = await prisma.engagement.findMany({
    where: { userId: req.userId! },
    include: { project: true },
    orderBy: { startDate: "desc" },
  });
  res.json({
    engagements: engagements.map((e) => ({
      ...e,
      paymentTermWarning: e.paymentTermDays > FREELANCE_ACT_MAX_DAYS,
    })),
  });
});

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createEngagementSchema = z.object({
  client: z.string().min(1).max(100),
  title: z.string().min(1).max(100),
  monthlyRate: z.number().int().min(10_000).max(10_000_000),
  startDate: dateStr,
  endDate: dateStr.nullable().optional(),
  settlementMin: z.number().int().min(0).max(400).default(140),
  settlementMax: z.number().int().min(0).max(400).default(180),
  paymentTermDays: z.number().int().min(0).max(180).default(30),
});

// いま働いている取引先を本人が登録する（エンジニア1st以外で見つけた案件でも、請求・入金管理が使える）
moneyRouter.post("/engagements", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createEngagementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容を確認してください", details: parsed.error.flatten() });
  const b = parsed.data;
  if (b.settlementMin > b.settlementMax) return res.status(400).json({ error: "精算幅は「下限 ≦ 上限」で入力してください" });
  const engagement = await prisma.engagement.create({
    data: {
      user: { connect: { id: req.userId! } },
      project: {
        create: {
          title: b.title,
          client: b.client,
          skills: "",
          unitPrice: b.monthlyRate,
          workStyle: "",
          description: "本人が登録した取引",
          isListed: false,
        },
      },
      monthlyRate: b.monthlyRate,
      startDate: new Date(b.startDate),
      endDate: b.endDate ? new Date(b.endDate) : null,
      settlementMin: b.settlementMin,
      settlementMax: b.settlementMax,
      paymentTermDays: b.paymentTermDays,
      status: "稼働中",
    },
    include: { project: true },
  });
  res.status(201).json({ engagement });
});

const termsSchema = z.object({
  settlementMin: z.number().int().min(0).max(400),
  settlementMax: z.number().int().min(0).max(400),
  paymentTermDays: z.number().int().min(0).max(180),
  monthlyRate: z.number().int().min(10_000).max(10_000_000).optional(),
  endDate: dateStr.nullable().optional(),
  status: z.enum(["稼働中", "終了"]).optional(),
});

moneyRouter.patch("/engagements/:id", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = termsSchema.safeParse(req.body);
  if (!parsed.success || parsed.data.settlementMin > parsed.data.settlementMax) {
    return res.status(400).json({ error: "精算幅は「下限 ≦ 上限」で入力してください" });
  }
  const engagement = await prisma.engagement.findUnique({ where: { id: req.params.id } });
  if (!engagement || engagement.userId !== req.userId) return res.status(404).json({ error: "稼働情報が見つかりません" });
  const { endDate, ...rest } = parsed.data;
  const updated = await prisma.engagement.update({
    where: { id: engagement.id },
    data: { ...rest, ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}) },
  });
  res.json({ engagement: updated });
});

// 請求書一覧（入金状況つき）
moneyRouter.get("/invoices", requireAuth, async (req: AuthedRequest, res) => {
  const invoices = await prisma.invoice.findMany({
    where: { engagement: { userId: req.userId! } },
    include: { engagement: { include: { project: true } } },
    orderBy: [{ targetMonth: "desc" }, { issuedAt: "desc" }],
  });
  const now = new Date();
  const withState = invoices.map((inv) => ({ ...inv, state: invoiceState(inv, now) }));
  const outstanding = withState.filter((i) => i.state !== "paid");
  res.json({
    invoices: withState,
    summary: {
      outstandingAmount: outstanding.reduce((s, i) => s + i.totalAmount - i.withholding, 0),
      overdueCount: withState.filter((i) => i.state === "overdue").length,
      paidThisYear: withState
        .filter((i) => i.paidAt && i.paidAt.getFullYear() === now.getFullYear())
        .reduce((s, i) => s + i.amount, 0),
    },
  });
});

// 精算プレビュー（保存しない）
moneyRouter.post("/invoices/preview", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = generateInvoiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容を確認してください" });
  const engagement = await prisma.engagement.findUnique({ where: { id: parsed.data.engagementId } });
  if (!engagement || engagement.userId !== req.userId) return res.status(404).json({ error: "稼働情報が見つかりません" });
  res.json({ preview: buildInvoice(engagement, parsed.data) });
});

const generateInvoiceSchema = z.object({
  engagementId: z.string(),
  targetMonth: z.string().regex(/^\d{4}-\d{2}$/),
  workHours: z.number().min(0).max(400).nullable().optional(),
  applyWithholding: z.boolean().default(false),
});

function buildInvoice(
  engagement: { monthlyRate: number; settlementMin: number; settlementMax: number; paymentTermDays: number },
  input: z.infer<typeof generateInvoiceSchema>
) {
  const settlement = calcSettlement({
    monthlyRate: engagement.monthlyRate,
    workHours: input.workHours ?? null,
    settlementMin: engagement.settlementMin,
    settlementMax: engagement.settlementMax,
  });
  const tax = calcTax(settlement.amount, 10);
  const withholding = input.applyWithholding ? calcWithholding(settlement.amount) : 0;
  return {
    ...tax,
    baseAmount: settlement.baseAmount,
    adjustment: settlement.adjustment,
    settlementNote: settlement.note,
    withholding,
    transferAmount: tax.totalAmount - withholding,
    dueDate: calcDueDate(input.targetMonth, engagement.paymentTermDays),
  };
}

// 請求書の自動生成
moneyRouter.post("/invoices", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = generateInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "入力内容を確認してください" });
  }
  const { engagementId, targetMonth, workHours } = parsed.data;

  const engagement = await prisma.engagement.findUnique({ where: { id: engagementId } });
  if (!engagement || engagement.userId !== req.userId) {
    return res.status(404).json({ error: "稼働情報が見つかりません" });
  }
  const duplicate = await prisma.invoice.findFirst({ where: { engagementId, targetMonth } });
  if (duplicate) {
    return res.status(409).json({ error: `${targetMonth}分の請求書はすでに発行済みです（${duplicate.invoiceNumber}）` });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  const b = buildInvoice(engagement, parsed.data);

  const invoice = await prisma.invoice.create({
    data: {
      engagementId: engagement.id,
      targetMonth,
      amount: b.amount,
      baseAmount: b.baseAmount,
      workHours: workHours ?? null,
      adjustment: b.adjustment,
      withholding: b.withholding,
      dueDate: b.dueDate,
      taxRate: b.taxRate,
      taxAmount: b.taxAmount,
      totalAmount: b.totalAmount,
      registrationNumber: user?.invoiceRegistrationNumber ?? "未登録（設定画面で登録番号を入力してください）",
      invoiceNumber: nextInvoiceNumber(targetMonth),
    },
  });

  res.status(201).json({ invoice });
});

// 入金の確認（取り消しも可能）
moneyRouter.post("/invoices/:id/paid", requireAuth, async (req: AuthedRequest, res) => {
  const paid = z.object({ paid: z.boolean() }).safeParse(req.body);
  if (!paid.success) return res.status(400).json({ error: "入力内容を確認してください" });
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: { engagement: true } });
  if (!invoice || invoice.engagement.userId !== req.userId) return res.status(404).json({ error: "請求書が見つかりません" });
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: paid.data.paid ? { paidAt: new Date(), status: "入金済み" } : { paidAt: null, status: "発行済み" },
  });
  res.json({ invoice: updated });
});

// 支払いが遅れているときの催促文
moneyRouter.get("/invoices/:id/reminder", requireAuth, async (req: AuthedRequest, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { engagement: { include: { project: true, user: true } } },
  });
  if (!invoice || invoice.engagement.userId !== req.userId) return res.status(404).json({ error: "請求書が見つかりません" });
  res.json({
    text: paymentReminderText({
      clientName: invoice.engagement.project.client,
      userName: invoice.engagement.user.name,
      invoiceNumber: invoice.invoiceNumber,
      targetMonth: invoice.targetMonth,
      totalAmount: invoice.totalAmount - invoice.withholding,
      dueDate: invoice.dueDate ?? new Date(),
    }),
  });
});

// 請求書PDFダウンロード
moneyRouter.get("/invoices/:id/pdf", requireAuth, async (req: AuthedRequest, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { engagement: { include: { project: true, user: true } } },
  });
  if (!invoice || invoice.engagement.userId !== req.userId) {
    return res.status(404).json({ error: "請求書が見つかりません" });
  }

  streamBillingPdf(res, {
    documentTitle: "請求書",
    documentNumber: invoice.invoiceNumber,
    issuerName: invoice.engagement.user.name,
    recipientName: invoice.engagement.project.client,
    targetMonth: invoice.targetMonth,
    baseAmount: invoice.baseAmount || invoice.amount,
    adjustment: invoice.adjustment,
    workHours: invoice.workHours,
    amount: invoice.amount,
    taxRate: invoice.taxRate,
    taxAmount: invoice.taxAmount,
    totalAmount: invoice.totalAmount,
    withholding: invoice.withholding,
    registrationNumber: invoice.registrationNumber,
    issuedAt: invoice.issuedAt,
    dueDate: invoice.dueDate,
  });
});

// 税金の取り分け目安（稼働中の単価から概算）
moneyRouter.get("/tax-reserve", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    include: { engagements: { where: { status: "稼働中" }, take: 1 } },
  });
  const q = req.query;
  const monthlyRate = Number(q.monthlyRate) || user?.engagements[0]?.monthlyRate || 600_000;
  const result = calcTaxReserve({
    monthlyRate,
    workingMonths: Math.min(12, Math.max(1, Number(q.workingMonths) || 12)),
    expenseRatio: q.expenseRatio != null ? Math.min(0.9, Math.max(0, Number(q.expenseRatio))) : 0.2,
    isBlueTaxReturn: q.blue !== "false",
    invoiceRegistered: q.invoice != null ? q.invoice === "true" : !!user?.invoiceRegistrationNumber,
    year: new Date().getFullYear(),
  });
  res.json({ monthlyRate, result });
});
