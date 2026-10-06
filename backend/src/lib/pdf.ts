import PDFDocument from "pdfkit";
import path from "path";
import { Response } from "express";
import type { InvoiceDocument } from "./invoice";

// 日本語を正しく描画するためのフォント（Noto Sans JP / SIL Open Font License）
const JP_FONT = path.join(__dirname, "../../assets/fonts/NotoSansJP.ttf");

const yen = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("ja-JP")}円`;
const INK = "#1d1d1d";
const SUB = "#555555";
const LINE = "#d6d5cd";
const PAPER = "#f6f5f0";

// 請求書のPDF（適格請求書の記載事項: 発行者と登録番号・取引年月日・取引内容・税率ごとの対価と適用税率・税率ごとの消費税額・受領者）
export function streamInvoicePdf(res: Response, d: InvoiceDocument) {
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `${d.title} ${d.number}` } });
  doc.registerFont("jp", JP_FONT);
  doc.font("jp");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${d.number}.pdf"`);
  doc.pipe(res);

  const L = 48;
  const R = doc.page.width - 48;
  const W = R - L;

  // タイトル
  doc.fontSize(22).fillColor(INK).text(d.title, L, 48, { width: W, align: "center", characterSpacing: 8 });

  // 右上: 番号・日付・登録番号
  let y = 92;
  doc.fontSize(8.5).fillColor(SUB);
  const meta = [`請求書番号　${d.number}`, `発行日　${d.issuedAt}`, ...(d.issuer.registrationNumber ? [`登録番号　${d.issuer.registrationNumber}`] : [])];
  for (const m of meta) {
    doc.text(m, L, y, { width: W, align: "right" });
    y += 13;
  }

  // 左: 宛先
  y = 130;
  doc.fontSize(14).fillColor(INK).text(`${d.recipient}　御中`, L, y, { width: W * 0.55 });
  y = doc.y + 2;
  doc.moveTo(L, y).lineTo(L + W * 0.55, y).lineWidth(0.8).strokeColor(INK).stroke();
  y += 10;
  doc.fontSize(9.5).fillColor(SUB).text(`件名：${d.subject}`, L, y, { width: W * 0.55 });
  doc.text("下記のとおりご請求申し上げます。", L, doc.y + 4, { width: W * 0.55 });
  const leftBottom = doc.y;

  // 右: 発行者
  const ix = L + W * 0.6;
  const iw = W * 0.4;
  let iy = 130;
  doc.fontSize(10.5).fillColor(INK);
  if (d.issuer.businessName) {
    doc.text(d.issuer.businessName, ix, iy, { width: iw });
    iy = doc.y;
  }
  doc.text(d.issuer.name, ix, iy, { width: iw });
  doc.fontSize(8.5).fillColor(SUB);
  const issuerLines = [
    d.issuer.postalCode ? `〒${d.issuer.postalCode}` : "",
    d.issuer.address ?? "",
    d.issuer.phone ? `TEL ${d.issuer.phone}` : "",
    d.issuer.email,
  ].filter(Boolean);
  for (const l of issuerLines) doc.text(l, ix, doc.y + 1, { width: iw });

  // ご請求金額
  y = Math.max(leftBottom, doc.y) + 18;
  doc.rect(L, y, W, 58).fill(PAPER);
  doc.fillColor(SUB).fontSize(9).text(d.withholding > 0 ? "ご請求金額（税込・源泉徴収後）" : "ご請求金額（税込）", L + 16, y + 12);
  doc.fillColor(INK).fontSize(22).text(yen(d.transfer), L, y + 14, { width: W - 16, align: "right" });
  doc.fillColor(SUB).fontSize(9).text(`お支払期日　${d.dueDate ?? "—"}`, L + 16, y + 36);
  y += 72;

  doc.fillColor(SUB).fontSize(9).text(`取引期間（役務の提供期間）　${d.period}`, L, y);
  y += 20;

  // 明細
  const cols = [
    { label: "品目", x: L, w: W * 0.5, align: "left" as const },
    { label: "数量", x: L + W * 0.5, w: W * 0.14, align: "right" as const },
    { label: "単価", x: L + W * 0.64, w: W * 0.17, align: "right" as const },
    { label: "金額", x: L + W * 0.81, w: W * 0.19, align: "right" as const },
  ];
  doc.rect(L, y, W, 20).fill(INK);
  doc.fillColor("#ffffff").fontSize(9);
  for (const c of cols) doc.text(c.label, c.x + 6, y + 5, { width: c.w - 12, align: c.align });
  y += 20;
  for (const line of d.lines) {
    const top = y + 7;
    doc.fillColor(INK).fontSize(9.5).text(line.label, cols[0].x + 6, top, { width: cols[0].w - 12 });
    let bottom = doc.y;
    if (line.detail) {
      doc.fillColor(SUB).fontSize(7.5).text(line.detail, cols[0].x + 6, bottom + 1, { width: cols[0].w - 12 });
      bottom = doc.y;
    }
    doc.fillColor(INK).fontSize(9.5);
    doc.text(line.quantity, cols[1].x + 6, top, { width: cols[1].w - 12, align: "right" });
    doc.text(line.unitPrice != null ? yen(line.unitPrice) : "", cols[2].x + 6, top, { width: cols[2].w - 12, align: "right" });
    doc.text(yen(line.amount), cols[3].x + 6, top, { width: cols[3].w - 12, align: "right" });
    y = bottom + 8;
    doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(LINE).stroke();
  }

  // 合計
  y += 10;
  const tx = L + W * 0.5;
  const tw = W * 0.5;
  const totals: [string, string, boolean][] = [
    ["小計（税抜）", yen(d.subtotal), false],
    [`消費税（${d.taxSummary[0]?.rate ?? 10}%）`, yen(d.taxTotal), false],
    ["合計（税込）", yen(d.total), true],
    ...(d.withholding > 0 ? ([["源泉徴収税額", yen(-d.withholding), false], ["差引ご請求金額", yen(d.transfer), true]] as [string, string, boolean][]) : []),
  ];
  for (const [label, value, strong] of totals) {
    doc.fillColor(strong ? INK : SUB).fontSize(strong ? 10.5 : 9.5);
    doc.text(label, tx, y, { width: tw * 0.55 });
    doc.text(value, tx, y, { width: tw, align: "right" });
    y = doc.y + 4;
    doc.moveTo(tx, y).lineTo(R, y).lineWidth(0.5).strokeColor(LINE).stroke();
    y += 6;
  }

  // 税率ごとの内訳（適格請求書の記載事項）
  y += 4;
  doc.fillColor(SUB).fontSize(8.5);
  for (const t of d.taxSummary) {
    doc.text(`${t.rate}%対象　${yen(t.base)}（税抜）　消費税　${yen(t.tax)}`, tx, y, { width: tw, align: "right" });
    y = doc.y + 2;
  }

  // 振込先
  y += 16;
  const boxH = 18 + Math.max(1, d.bankLines.length) * 14;
  doc.rect(L, y, W * 0.55, boxH).lineWidth(0.8).strokeColor(LINE).stroke();
  doc.fillColor(INK).fontSize(9.5).text("お振込先", L + 12, y + 8);
  doc.fillColor(INK).fontSize(9);
  if (d.bankLines.length === 0) doc.fillColor(SUB).text("（振込先が未登録です）", L + 80, y + 8);
  d.bankLines.forEach((l, i) => doc.text(l, L + 80, y + 8 + i * 14, { width: W * 0.55 - 92 }));
  y += boxH + 16;

  // 備考
  doc.fillColor(INK).fontSize(9.5).text("備考", L, y);
  y = doc.y + 4;
  doc.fillColor(SUB).fontSize(8.5);
  for (const n of d.notes) {
    doc.text(`・${n}`, L, y, { width: W });
    y = doc.y + 2;
  }

  // 下余白の中に書くと改ページされるので、余白を外してから1行だけ書く
  doc.page.margins.bottom = 0;
  doc.fontSize(7).fillColor("#999999").text("エンジニア・ガレージで作成", L, doc.page.height - 32, { width: W, align: "right", lineBreak: false });
  doc.end();
}
