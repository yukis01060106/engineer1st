import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import {
  invoiceState,
  nextInvoiceNumber,
  paymentReminderText,
  buildInvoiceRecord,
  buildInvoiceDocument,
  parseBillingProfile,
  bankComplete,
  REGISTRATION_NUMBER_PATTERN,
  FREELANCE_ACT_MAX_DAYS,
  IssuerInfo,
} from "../lib/invoice";
import { calcTaxReserve } from "../lib/taxReserve";
import { streamInvoicePdf } from "../lib/pdf";

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
  settlementMethod: z.enum(["updown", "middle", "fixed"]).default("updown"),
  unitRounding: z.union([z.literal(1), z.literal(10), z.literal(100)]).default(1),
  hoursUnitMinutes: z.union([z.literal(1), z.literal(15), z.literal(30), z.literal(60)]).default(1),
  billingName: z.string().trim().max(100).nullable().optional(),
});

// いま働いている取引先を本人が登録する（ソトバ以外で見つけた案件でも、請求・入金管理が使える）
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
      settlementMethod: b.settlementMethod,
      unitRounding: b.unitRounding,
      hoursUnitMinutes: b.hoursUnitMinutes,
      billingName: b.billingName || null,
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
  settlementMethod: z.enum(["updown", "middle", "fixed"]).optional(),
  unitRounding: z.union([z.literal(1), z.literal(10), z.literal(100)]).optional(),
  hoursUnitMinutes: z.union([z.literal(1), z.literal(15), z.literal(30), z.literal(60)]).optional(),
  billingName: z.string().trim().max(100).nullable().optional(),
});

moneyRouter.patch("/engagements/:id", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = termsSchema.safeParse(req.body);
  if (!parsed.success || parsed.data.settlementMin > parsed.data.settlementMax) {
    return res.status(400).json({ error: "精算幅は「下限 ≦ 上限」で入力してください" });
  }
  const engagement = await prisma.engagement.findUnique({ where: { id: req.params.id } });
  if (!engagement || engagement.userId !== req.userId) return res.status(404).json({ error: "稼働情報が見つかりません" });
  const { endDate, billingName, ...rest } = parsed.data;
  const updated = await prisma.engagement.update({
    where: { id: engagement.id },
    data: {
      ...rest,
      ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      ...(billingName !== undefined ? { billingName: billingName || null } : {}),
    },
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

const generateInvoiceSchema = z.object({
  engagementId: z.string(),
  targetMonth: z.string().regex(/^\d{4}-\d{2}$/),
  workHours: z.number().min(0).max(400).nullable().optional(),
  applyWithholding: z.boolean().default(false),
  notes: z.string().max(300).nullable().optional(),
});

// 発行者情報（設定画面で登録した内容）。発行のたびに請求書へ写しておき、あとで設定を変えても過去の請求書は変わらない
export function issuerOf(user: { name: string; email: string; invoiceRegistrationNumber: string | null; billingProfile: string }): IssuerInfo {
  const reg = user.invoiceRegistrationNumber;
  return {
    name: user.name,
    email: user.email,
    ...parseBillingProfile(user.billingProfile),
    registrationNumber: reg && REGISTRATION_NUMBER_PATTERN.test(reg) ? reg : null,
  };
}

async function loadForInvoice(userId: string, engagementId: string) {
  const [engagement, user] = await Promise.all([
    prisma.engagement.findUnique({ where: { id: engagementId }, include: { project: true } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  if (!engagement || !user || engagement.userId !== userId) return null;
  return { engagement, user, issuer: issuerOf(user) };
}

function recordFor(ctx: NonNullable<Awaited<ReturnType<typeof loadForInvoice>>>, input: z.infer<typeof generateInvoiceSchema>) {
  const e = ctx.engagement;
  return buildInvoiceRecord(
    e,
    { targetMonth: input.targetMonth, workHours: input.workHours ?? null, applyWithholding: input.applyWithholding, notes: input.notes },
    ctx.issuer,
    { name: e.billingName || e.project.client, projectTitle: e.project.title }
  );
}

// 精算プレビュー（保存しない）。発行前の確認に、請求書と同じ見た目の内容も返す
moneyRouter.post("/invoices/preview", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = generateInvoiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容を確認してください" });
  const ctx = await loadForInvoice(req.userId!, parsed.data.engagementId);
  if (!ctx) return res.status(404).json({ error: "稼働情報が見つかりません" });
  const r = recordFor(ctx, parsed.data);
  res.json({
    preview: r,
    issuerReady: { registration: !!ctx.issuer.registrationNumber, bank: bankComplete(ctx.issuer.bank) },
  });
});

// 請求書の発行
moneyRouter.post("/invoices", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = generateInvoiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "入力内容を確認してください" });
  const ctx = await loadForInvoice(req.userId!, parsed.data.engagementId);
  if (!ctx) return res.status(404).json({ error: "稼働情報が見つかりません" });
  const { targetMonth } = parsed.data;
  const duplicate = await prisma.invoice.findFirst({ where: { engagementId: ctx.engagement.id, targetMonth } });
  if (duplicate) {
    return res.status(409).json({ error: `${targetMonth}分の請求書はすでに発行済みです（${duplicate.invoiceNumber}）。直すときは、発行済みの請求書を取り消してから発行し直してください` });
  }
  const { transferAmount: _t, ...data } = recordFor(ctx, parsed.data);
  const invoice = await prisma.invoice.create({
    data: { ...data, engagementId: ctx.engagement.id, invoiceNumber: nextInvoiceNumber(targetMonth) },
  });
  res.status(201).json({ invoice });
});

// 発行した請求書の取り消し（入金済みは取り消せない）。内容を直すときは取り消して発行し直す
moneyRouter.delete("/invoices/:id", requireAuth, async (req: AuthedRequest, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: { engagement: true } });
  if (!invoice || invoice.engagement.userId !== req.userId) return res.status(404).json({ error: "請求書が見つかりません" });
  if (invoice.paidAt) return res.status(400).json({ error: "入金済みの請求書は取り消せません。先に入金の確認を取り消してください" });
  await prisma.invoice.delete({ where: { id: invoice.id } });
  res.status(204).end();
});

async function documentFor(userId: string, id: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { engagement: { include: { project: true, user: true } } },
  });
  if (!invoice || invoice.engagement.userId !== userId) return null;
  const { engagement } = invoice;
  return buildInvoiceDocument({
    ...invoice,
    fallbackIssuer: { name: engagement.user.name, email: engagement.user.email },
    fallbackRecipient: engagement.billingName || engagement.project.client,
    projectTitle: engagement.project.title,
  });
}

// 請求書の中身（印刷用ページで使う）
moneyRouter.get("/invoices/:id/document", requireAuth, async (req: AuthedRequest, res) => {
  const doc = await documentFor(req.userId!, req.params.id);
  if (!doc) return res.status(404).json({ error: "請求書が見つかりません" });
  res.json({ document: doc });
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
  const doc = await documentFor(req.userId!, req.params.id);
  if (!doc) return res.status(404).json({ error: "請求書が見つかりません" });
  streamInvoicePdf(res, doc);
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
