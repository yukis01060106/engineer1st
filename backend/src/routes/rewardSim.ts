import { Router } from "express";
import { z } from "zod";
import { simulateReward, simulateSalary } from "../lib/rewardSimulator";

export const rewardSimRouter = Router();

const schema = z.object({
  monthlyRate: z.number().positive(),
  workingMonths: z.number().min(1).max(12).default(12),
  expenseRatio: z.number().min(0).max(0.9).default(0.2),
  isBlueTaxReturn: z.boolean().default(true),
  // 会社員の年収（任意）。入力されたら独立した場合との比較を返す
  currentSalary: z.number().positive().optional(),
});

rewardSimRouter.post("/", (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "入力内容を確認してください", details: parsed.error.flatten() });
  }
  const { currentSalary, ...input } = parsed.data;
  const result = simulateReward(input);
  const salary = currentSalary ? simulateSalary(currentSalary) : null;
  res.json({ input: parsed.data, result, salary });
});
