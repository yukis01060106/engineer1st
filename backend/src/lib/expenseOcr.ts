// レシート画像のOCR生テキストから、日付・金額・店名を推定する（ヒューリスティック）。
// OCRは完全ではないため、抽出結果は必ず本人が確認・編集してから保存する前提の設計。
//
// 日本語OCR（Tesseract jpn）は文字間にスペースが入ったり、桁区切りのカンマがピリオドに
// 誤認識されたりすることが多いため、そうした揺れを吸収できる正規表現にしている。

export interface ExtractedExpense {
  date: string | null; // "YYYY-MM-DD"
  amount: number | null;
  vendor: string | null;
}

// 数字と年/月/日の間に空白が入ってもマッチするようにする
const DATE_PATTERN = /(20\d{2})\s*[年/.-]\s*(\d{1,2})\s*[月/.-]\s*(\d{1,2})\s*日?/;

// 「円」の直前にある、数字・カンマ・ピリオド・空白からなる金額らしき文字列を拾う
const AMOUNT_NEAR_YEN = /([0-9][0-9,.\s]{0,10}[0-9]|[0-9])\s*円/g;

const TOTAL_KEYWORDS = ["合計", "お会計", "総額", "ご請求", "計"];

function toHalfWidth(text: string): string {
  return text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

// 日本語OCRは文字間に余計な空白を挟むことが多いため、仮名・漢字が連続する箇所の空白を除去する
function collapseJapaneseSpacing(text: string): string {
  return text.replace(/([぀-ヿ一-鿿])\s+(?=[぀-ヿ一-鿿])/g, "$1");
}

function parseAmountToken(token: string): number {
  return Number(token.replace(/[,.\s]/g, ""));
}

function findAmounts(text: string): number[] {
  return [...text.matchAll(AMOUNT_NEAR_YEN)]
    .map((m) => parseAmountToken(m[1]))
    .filter((n) => !Number.isNaN(n) && n > 0);
}

export function extractExpenseFromText(rawText: string): ExtractedExpense {
  const text = toHalfWidth(rawText);
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // 日付の推定（文字間のスペースを許容）
  let date: string | null = null;
  const dateMatch = text.match(DATE_PATTERN);
  if (dateMatch) {
    const [, y, m, d] = dateMatch;
    date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // 金額の推定: 「合計」等のキーワードを含む行を優先し、なければ最大の金額を採用
  let amount: number | null = null;
  const totalLine = lines.find((l) => TOTAL_KEYWORDS.some((k) => l.includes(k)));
  if (totalLine) {
    const amounts = findAmounts(totalLine);
    if (amounts.length > 0) amount = amounts[amounts.length - 1];
  }
  if (amount === null) {
    const allAmounts = findAmounts(text);
    if (allAmounts.length > 0) amount = Math.max(...allAmounts);
  }

  // 店名の推定: 先頭付近の、日付・金額パターンを含まない行を採用
  const vendorLine =
    lines.find(
      (l) =>
        l.length >= 2 &&
        l.length <= 30 &&
        !DATE_PATTERN.test(l) &&
        !TOTAL_KEYWORDS.some((k) => l.includes(k)) &&
        !/^[0-9¥￥,.\s]+$/.test(l)
    ) ?? null;
  const vendor = vendorLine ? collapseJapaneseSpacing(vendorLine) : null;

  return { date, amount, vendor };
}
