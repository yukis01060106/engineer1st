// AI FP: 本人の契約・請求・資産データを前提に答える。
// ANTHROPIC_API_KEY（または ANTHROPIC_AUTH_TOKEN）があれば Claude で回答し、なければルールベースで回答する
import Anthropic from "@anthropic-ai/sdk";
import { FinancialSnapshot, snapshotToText } from "./fpContext";

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

const man = (n: number) => `約${Math.round(n / 10_000).toLocaleString()}万円`;

// APIキーがない環境向け。本人データを使って、よくある質問に答える
export function ruleBasedAnswer(s: FinancialSnapshot, q: string): string {
  const rate = s.current?.monthlyRate ?? 0;
  const net = s.reward?.netIncomeMonthly ?? 0;
  const living = s.plan?.monthlyLivingCost ?? 250_000;
  const cash = s.plan?.cashSavings ?? 0;

  if (s.invoices.overdueCount > 0 && /(遅|入金|未払|催促|払われ)/.test(q)) {
    return `支払期日を過ぎた請求が${s.invoices.overdueCount}件（${man(s.invoices.overdueAmount)}）あります。まずは「請求・入金」画面の催促文テンプレートで、丁寧に入金予定日を確認しましょう。フリーランス法では、給付の受領から60日以内に支払期日を定めることになっています。`;
  }

  const upMatch = q.match(/([0-9０-９]+)\s*万円?.*(上が|アップ|増)/);
  if (upMatch) {
    const up = Number(upMatch[1].replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))) * 10_000;
    const r = s.reserve?.reserveRate ?? 0.3;
    const netUp = Math.round(up * (1 - 0.2) * (1 - r));
    return `月単価が${man(up)}上がると、年間売上は${man(up * 12)}増えます。税金・保険料（入金の約${Math.round(r * 100)}%）と経費を差し引くと、手取りは月${man(netUp)}ほど増える見込みです。増えた分をそのまま小規模企業共済やiDeCoに回すと、所得控除で税負担も下がります（概算です）。`;
  }

  if (/(終わ|切れ|空白|途切|終了|次の案件)/.test(q)) {
    const months = living > 0 ? Math.floor(cash / living) : 0;
    const left = s.current?.daysLeft != null ? `今の契約は残り${s.current.daysLeft}日です。` : "";
    return `${left}案件が途切れると、面談から契約まで最低3〜4週間は収入がありません。今の預金${man(cash)}は、生活費（月${man(living)}）の${months}か月分です。${months < 6 ? "目安の6か月分に届くまでは、積立より現金を優先しましょう。" : "6か月分の備えはできています。"}あわせて、翌年の住民税・国民健康保険は前年の所得で決まるため、収入がない月も支払いが続く点に注意してください。`;
  }

  if (/(税|取り分|住民税|国保|保険料|消費税|インボイス)/.test(q) && s.reserve) {
    const r = s.reserve;
    return `今の単価（月${man(rate)}）だと、税金・保険料の合計は年${man(r.totalAnnual)}ほどの見込みです。入金のたびに約${Math.round(r.reserveRate * 100)}%（月${man(r.monthlyReserve)}）を別口座に取り分けておくと安心です。特に住民税と国民健康保険は6月に通知が届き、まとまった額になります。消費税は「${r.consumptionTaxLabel}」で計算しています（概算です）。`;
  }

  if (/(共済|iDeCo|イデコ|NISA|ニーサ|積立|老後|資産|投資|年金)/i.test(q)) {
    const surplus = Math.max(0, net - living);
    const w = s.wealth;
    const sug = w?.suggestion;
    return `フリーランスには退職金も厚生年金もないため、「生活防衛資金（生活費6か月分）→ 小規模企業共済 → iDeCo → NISA」の順がおすすめです。手取り月${man(net)}から生活費を引いた余力は月${man(surplus)}です。${sug ? `この余力なら、共済${man(sug.kyosai)}・iDeCo${man(sug.ideco)}・NISA${man(sug.nisa)}程度が無理のない目安です。` : "「資産形成」画面で生活費と預金を入力すると、あなたに合った積立額を試算できます。"}共済とiDeCoは掛金が全額所得控除になります。個別の商品選びは提携FPにご相談ください。`;
  }

  return `今の状況をまとめると、手取りは月${man(net)}ほど、税金・保険料の取り分けは入金の約${Math.round((s.reserve?.reserveRate ?? 0.3) * 100)}%が目安です。「来月で案件が終わったら？」「単価が5万円上がったら？」「iDeCoと共済どっちが先？」のように聞いてもらえれば、あなたの数字で試算します。`;
}
