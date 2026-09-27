import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import Tesseract from "tesseract.js";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { extractExpenseFromText } from "../lib/expenseOcr";
import { buildExpenseCsv } from "../lib/expenseCsv";

export const expensesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("画像ファイルを選択してください"));
    }
    cb(null, true);
  },
});

// レシート画像をOCRで読み取り、日付・金額・店名を推定して返す（保存はまだしない。本人の確認・編集を挟む）
expensesRouter.post("/ocr", requireAuth, upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "画像を選択してください" });
  }

  try {
    const { data } = await Tesseract.recognize(req.file.buffer, "jpn+eng");
    const extracted = extractExpenseFromText(data.text);
    res.json({ extracted, rawText: data.text });
  } catch (err) {
    res.status(500).json({ error: "OCRの読み取りに失敗しました。手入力で登録してください。" });
  }
});

const createExpenseSchema = z.object({
  date: z.string(), // "YYYY-MM-DD"
  vendor: z.string().min(1),
  amount: z.number().positive(),
  category: z.string().min(1),
  memo: z.string().max(500).nullable().optional(),
  ocrRawText: z.string().nullable().optional(),
});

expensesRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const expenses = await prisma.expense.findMany({
    where: { userId: req.userId! },
    orderBy: { date: "desc" },
  });
  res.json({ expenses });
});

expensesRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "入力内容を確認してください", details: parsed.error.flatten() });
  }
  const { date, vendor, amount, category, memo, ocrRawText } = parsed.data;

  const expense = await prisma.expense.create({
    data: {
      userId: req.userId!,
      date: new Date(date),
      vendor,
      amount,
      category,
      memo: memo ?? null,
      ocrRawText: ocrRawText ?? null,
    },
  });

  res.status(201).json({ expense });
});

expensesRouter.delete("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!expense || expense.userId !== req.userId) {
    return res.status(404).json({ error: "経費が見つかりません" });
  }
  await prisma.expense.delete({ where: { id: expense.id } });
  res.status(204).end();
});

// freee・マネーフォワード クラウド会計の仕訳インポート画面で読み込める汎用CSVを出力する
expensesRouter.get("/export.csv", requireAuth, async (req: AuthedRequest, res) => {
  const expenses = await prisma.expense.findMany({
    where: { userId: req.userId! },
    orderBy: { date: "desc" },
  });

  const csv = buildExpenseCsv(expenses);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="expenses.csv"');
  res.send(csv);
});
