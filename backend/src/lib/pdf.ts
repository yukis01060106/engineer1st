import PDFDocument from "pdfkit";
import path from "path";
import { Response } from "express";

export interface BillingDocumentData {
  documentTitle: string;
  documentNumber: string;
  issuerName: string;
  recipientName: string;
  targetMonth: string;
  baseAmount: number;
  adjustment: number;
  workHours: number | null;
  amount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  withholding: number;
  registrationNumber: string;
  issuedAt: Date;
  dueDate: Date | null;
}

// 日本語を正しく描画するためのフォント（Noto Sans JP / SIL Open Font License）
const JP_FONT = path.join(__dirname, "../../assets/fonts/NotoSansJP.ttf");

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

// 請求書のPDFを生成してレスポンスにストリームする（インボイス制度の記載要件を満たす体裁）
export function streamBillingPdf(res: Response, data: BillingDocumentData) {
  const doc = new PDFDocument({ size: "A4", margin: 56 });
  doc.registerFont("jp", JP_FONT);
  doc.font("jp");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${data.documentNumber}.pdf"`);
  doc.pipe(res);

  const left = 56;
  const right = doc.page.width - 56;
  const width = right - left;

  doc.fontSize(22).fillColor("#1d1d1d").text(data.documentTitle, left, 56, { width, align: "center", characterSpacing: 6 });
  doc.moveDown(1.2);

  doc.fontSize(9).fillColor("#555555");
  doc.text(`請求書番号　${data.documentNumber}`, { align: "right" });
  doc.text(`発行日　${data.issuedAt.toLocaleDateString("ja-JP")}`, { align: "right" });
  doc.moveDown(1);

  doc.fontSize(14).fillColor("#1d1d1d").text(`${data.recipientName}　御中`, left);
  doc.moveDown(0.4);
  doc.fontSize(10).fillColor("#555555").text(`${data.targetMonth.replace("-", "年")}月分の業務委託料として、下記のとおりご請求申し上げます。`);
  doc.moveDown(1);

  const transfer = data.totalAmount - data.withholding;
  const boxY = doc.y;
  doc.rect(left, boxY, width, 54).fill("#f6f5f0");
  doc.fillColor("#1d1d1d").fontSize(11).text("ご請求金額（税込）", left + 16, boxY + 18);
  doc.fontSize(20).text(yen(transfer), left, boxY + 13, { width: width - 16, align: "right" });
  doc.y = boxY + 72;

  const rows: [string, string][] = [
    ["月額（精算前）", yen(data.baseAmount)],
  ];
  if (data.workHours != null) rows.push([`稼働時間`, `${data.workHours}時間`]);
  if (data.adjustment !== 0) rows.push([data.adjustment > 0 ? "超過精算" : "控除精算", `${data.adjustment > 0 ? "+" : "-"}${yen(Math.abs(data.adjustment))}`]);
  rows.push(["小計（10%対象・税抜）", yen(data.amount)]);
  rows.push([`消費税（${data.taxRate}%）`, yen(data.taxAmount)]);
  rows.push(["合計（税込）", yen(data.totalAmount)]);
  if (data.withholding > 0) rows.push(["源泉徴収税額", `-${yen(data.withholding)}`]);

  doc.fontSize(10.5);
  for (const [label, value] of rows) {
    const y = doc.y;
    doc.fillColor("#333333").text(label, left, y);
    doc.text(value, left, y, { width, align: "right" });
    doc.moveTo(left, doc.y + 4).lineTo(right, doc.y + 4).lineWidth(0.5).strokeColor("#e5e4de").stroke();
    doc.y += 10;
  }

  doc.moveDown(1.5);
  doc.fontSize(10).fillColor("#1d1d1d");
  if (data.dueDate) doc.text(`お支払期日　${data.dueDate.toLocaleDateString("ja-JP")}`);
  doc.moveDown(1.5);
  doc.text(`発行者　${data.issuerName}`);
  doc.text(`登録番号（適格請求書発行事業者）　${data.registrationNumber}`);

  doc.moveDown(2);
  doc.fontSize(8).fillColor("#888888").text("本書はエンジニア1stにより自動生成された書類です。");

  doc.end();
}
