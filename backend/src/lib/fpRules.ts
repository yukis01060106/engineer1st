// APIキーがない環境（デモ版を含む）向けのAI FP。本人データを使って、よくある質問にルールベースで答える
import type { FinancialSnapshot } from "./fpSnapshot";

const man = (n: number) => `約${Math.round(n / 10_000).toLocaleString()}万円`;

export function ruleBasedAnswer(s: FinancialSnapshot, q: string): string {
  const rate = s.current?.monthlyRate ?? 0;
  const net = s.monthlyNetIncome;
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
    if (!s.isSelfEmployed) {
      return `会社員のうちは小規模企業共済に入れないので、「生活防衛資金（生活費6か月分）→ iDeCo → NISA」の順がおすすめです。手取り月${man(net)}から生活費を引いた余力は月${man(surplus)}です。${sug ? `この余力なら、iDeCo${man(sug.ideco)}・NISA${man(sug.nisa)}程度が無理のない目安です。` : "「将来の備え」画面で年収と生活費を入力すると、あなたに合った積立額を試算できます。"}独立したら、退職金の代わりに小規模企業共済も検討しましょう。個別の商品選びは提携FPにご相談ください。`;
    }
    return `フリーランスには退職金も厚生年金もないため、「生活防衛資金（生活費6か月分）→ 小規模企業共済 → iDeCo → NISA」の順がおすすめです。手取り月${man(net)}から生活費を引いた余力は月${man(surplus)}です。${sug ? `この余力なら、共済${man(sug.kyosai)}・iDeCo${man(sug.ideco)}・NISA${man(sug.nisa)}程度が無理のない目安です。` : "「将来の備え」画面で生活費と預金を入力すると、あなたに合った積立額を試算できます。"}共済とiDeCoは掛金が全額所得控除になります。個別の商品選びは提携FPにご相談ください。`;
  }

  if (!s.isSelfEmployed) {
    return `今の手取りは月${man(net)}ほどの見込みです（年収の入力がなければ0円で計算しています）。「独立したら手取りはどう変わる？」「iDeCoとNISAどっちが先？」「生活防衛資金はいくら必要？」のように聞いてもらえれば、あなたの数字で試算します。`;
  }
  return `今の状況をまとめると、手取りは月${man(net)}ほど、税金・保険料の取り分けは入金の約${Math.round((s.reserve?.reserveRate ?? 0.3) * 100)}%が目安です。「来月で案件が終わったら？」「単価が5万円上がったら？」「iDeCoと共済どっちが先？」のように聞いてもらえれば、あなたの数字で試算します。`;
}
