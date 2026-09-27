import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, optionalAuth, AuthedRequest } from "../middleware/auth";

export const rateDiagnosisRouter = Router();

// 十分な自己申告データが溜まるまでの間、参考にする業界のざっくりした目安（月単価・円）
// 出典: 各種フリーランスエンジニア向け単価調査の公開レンジを参考にした概算値。実データが増えるほどこの目安の重みは下がる。
const INDUSTRY_BASELINE: Record<string, number> = {
  フロントエンドエンジニア: 650_000,
  バックエンドエンジニア: 680_000,
  インフラエンジニア: 700_000,
  フルスタックエンジニア: 720_000,
  データエンジニア: 750_000,
  "PM/PMO": 780_000,
};

const EXPERIENCE_BAND = 2; // 経験年数の比較幅（±年）
const MIN_SAMPLE_FOR_COMPARISON = 5;

const submitSchema = z.object({
  primarySkill: z.string().min(1),
  role: z.string().min(1),
  yearsOfExperience: z.number().min(0).max(50),
  monthlyRate: z.number().positive(),
  chainDepth: z.number().min(1).max(10).optional(),
});

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// 商流の階層についての業界データに基づくソフトな注意喚起（個人への断定はしない）
function chainDepthNote(chainDepth?: number): string | null {
  if (!chainDepth) return null;
  if (chainDepth >= 3) {
    return "商流の階層が3社以上の場合、業界データでは中抜き率が40%以上になっているケースが多く報告されています。ご自身の契約条件を確認してみることをおすすめします（あくまで業界傾向であり、個別の契約を断定するものではありません）。";
  }
  return "商流の階層が浅い場合は、中間マージンの影響を比較的受けにくい傾向があります。";
}

rateDiagnosisRouter.post("/", optionalAuth, async (req: AuthedRequest, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "入力内容を確認してください", details: parsed.error.flatten() });
  }
  const { primarySkill, role, yearsOfExperience, monthlyRate, chainDepth } = parsed.data;

  // 似た条件（役割・主要スキル・経験年数±2年）の自己申告データを集計
  const similar = await prisma.rateDiagnosis.findMany({
    where: {
      role,
      primarySkill,
      yearsOfExperience: { gte: yearsOfExperience - EXPERIENCE_BAND, lte: yearsOfExperience + EXPERIENCE_BAND },
    },
    select: { monthlyRate: true },
  });

  const rates = similar.map((s) => s.monthlyRate);
  const hasEnoughData = rates.length >= MIN_SAMPLE_FOR_COMPARISON;

  const comparisonRate = hasEnoughData
    ? median(rates)
    : INDUSTRY_BASELINE[role] ?? Math.round(Object.values(INDUSTRY_BASELINE).reduce((a, b) => a + b, 0) / Object.keys(INDUSTRY_BASELINE).length);

  const diffRatio = Math.round(((monthlyRate - comparisonRate) / comparisonRate) * 1000) / 10;

  let message: string;
  if (diffRatio >= 5) {
    message = `似た条件のエンジニアの相場と比べて、あなたの単価は約${diffRatio}%高い可能性があります。`;
  } else if (diffRatio <= -5) {
    message = `似た条件のエンジニアの相場と比べて、あなたの単価は約${Math.abs(diffRatio)}%低い可能性があります。`;
  } else {
    message = "似た条件のエンジニアの相場とほぼ同水準の可能性があります。";
  }

  // 参考データとして保存（ログインしていれば本人に紐付け、していなければ匿名で母数に追加）
  await prisma.rateDiagnosis.create({
    data: {
      userId: req.userId ?? null,
      primarySkill,
      role,
      yearsOfExperience,
      monthlyRate,
      chainDepth,
    },
  });

  res.status(201).json({
    result: {
      comparisonRate,
      dataSource: hasEnoughData ? "similar_users" : "industry_baseline",
      sampleSize: rates.length,
      diffRatio,
      message,
      chainDepthNote: chainDepthNote(chainDepth),
      disclaimer:
        "本診断はユーザーの自己申告データ、および入力データが不足する場合は業界の公開情報に基づく概算です。実際の契約内容や市場価値を保証するものではありません。",
    },
  });
});

rateDiagnosisRouter.get("/mine", requireAuth, async (req: AuthedRequest, res) => {
  const diagnoses = await prisma.rateDiagnosis.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
  });
  res.json({ diagnoses });
});
