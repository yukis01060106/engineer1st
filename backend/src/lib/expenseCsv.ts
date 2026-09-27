// freee / マネーフォワード クラウド会計の仕訳インポート画面で読み込める汎用CSV形式を出力する。
// 列の完全な対応関係は取り込み時の設定画面で調整が必要（各社の公式インポート仕様は変更されうるため、
// ここでは両サービスの取り込みで共通して使える基本列のみを出力する）。

export interface ExpenseCsvRow {
  date: Date;
  vendor: string;
  category: string;
  amount: number;
  memo: string | null;
}

const HEADER = ["発生日", "取引先", "勘定科目", "税区分", "金額", "備考"];

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export function buildExpenseCsv(rows: ExpenseCsvRow[]): string {
  const lines = [HEADER.join(",")];
  for (const row of rows) {
    lines.push(
      [
        formatDate(row.date),
        csvEscape(row.vendor),
        csvEscape(row.category),
        "課税仕入10%",
        String(row.amount),
        csvEscape(row.memo ?? ""),
      ].join(",")
    );
  }
  // Excelで開いた際に文字化けしないようUTF-8 BOMを付与
  return "﻿" + lines.join("\r\n");
}
