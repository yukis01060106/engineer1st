// AI FP: 本人の契約・請求・資産データを前提に答える。
// ANTHROPIC_API_KEY（または ANTHROPIC_AUTH_TOKEN）があれば Claude で回答し、なければルールベースで回答する
import Anthropic from "@anthropic-ai/sdk";
import { FinancialSnapshot, snapshotToText } from "./fpSnapshot";
import { ruleBasedAnswer } from "./fpRules";

const MODEL = "claude-opus-5";

// 変わらない指示（キャッシュ対象）。本人データは別ブロックで後ろに置く
const SYSTEM_PROMPT = `あなたは「エンジニア1st」のAI FP（ファイナンシャルプランナーのアシスタント）です。相手は日本のフリーランスエンジニア、またはSES企業で働く会社員です。

役割:
- 本人の契約単価・契約終了日・請求と入金の状況・資産形成プランのデータをもとに、税金の取り分け、手取り、生活防衛資金、小規模企業共済・iDeCo・NISAの使い方を、本人の数字で具体的に説明する。
- 「案件が来月で終わったら」「単価が5万円上がったら」のような仮定の質問には、データを前提に概算で答え、計算の前提を1行で示す。

守ること:
- 特定の金融商品・銘柄・売買のタイミングは勧めない（投資助言にあたるため）。制度の一般的な説明と、本人データを使った試算にとどめる。個別商品の相談は、提携FP・税理士への相談をすすめる。
- 税額や保険料は概算であることを添える。制度は変わるため、断定が必要な場面では税理士や自治体に確認するよう伝える。
- 支払期日を過ぎた請求があれば、まずその回収を優先するよう伝える（フリーランス法では給付の受領から60日以内に支払期日を定める必要がある）。
- 日本語で、結論を先に、200〜400字程度で簡潔に答える。見出しは使わず、必要なら短い箇条書きを使う。金額は「約◯万円」のように読みやすく書く。`;

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return null;
  client ??= new Anthropic();
  return client;
}

export interface FpTurn {
  role: "user" | "assistant";
  content: string;
}

export async function answerFp(snapshot: FinancialSnapshot, history: FpTurn[], question: string): Promise<{ text: string; source: "claude" | "rules" }> {
  const anthropic = getClient();
  if (anthropic) {
    try {
      const response = await anthropic.beta.messages.create({
        model: MODEL,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
          { type: "text", text: `# 本人のデータ（${new Date().toLocaleDateString("ja-JP")}時点）\n${snapshotToText(snapshot)}` },
        ],
        messages: [...history.slice(-10), { role: "user", content: question }],
      } as Anthropic.Beta.MessageCreateParamsNonStreaming);

      if (response.stop_reason === "refusal") {
        return { text: "この内容にはお答えできません。提携FP・税理士への相談をご利用ください。", source: "claude" };
      }
      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (text) return { text, source: "claude" };
    } catch (err) {
      console.error("AI FP: Claude APIの呼び出しに失敗したためルールベースで回答します", err);
    }
  }
  return { text: ruleBasedAnswer(snapshot, question), source: "rules" };
}
