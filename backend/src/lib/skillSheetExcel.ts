import ExcelJS from "exceljs";
import { Response } from "express";
import type { SkillSheetDocument } from "./skillSheet";

// SESのスキルシートで一般的な体裁（A4横・1枚目に基本情報とスキル要約、続けて職務経歴の表と工程の●）
const INK = "FF1D1D1D";
const PAPER = "FFF6F5F0";
const LINE = "FFBFBDB5";
const FONT = "游ゴシック";

const thin: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: LINE } },
  left: { style: "thin", color: { argb: LINE } },
  bottom: { style: "thin", color: { argb: LINE } },
  right: { style: "thin", color: { argb: LINE } },
};

// 列: A=No B=期間 C=業務内容 D=役割・規模 E=環境 F〜M=工程（8つ）
const COLS = [5, 15, 50, 13, 34, 5.2, 5.2, 5.2, 5.2, 5.2, 5.2, 5.2, 5.2];
const LAST = COLS.length;

const lineCount = (text: string, widthChars: number) =>
  text.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil([...l].reduce((w, ch) => w + (ch.charCodeAt(0) > 0xff ? 2 : 1), 0) / (widthChars * 1.1))), 0);

export async function streamSkillSheetExcel(res: Response, d: SkillSheetDocument) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "エンジニア・ガレージ";
  const ws = wb.addWorksheet("スキルシート", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    views: [{ showGridLines: false }],
  });
  ws.columns = COLS.map((width) => ({ width }));
  ws.properties.defaultRowHeight = 18;

  const style = (cell: ExcelJS.Cell, opts: { bold?: boolean; size?: number; color?: string; fill?: string; align?: "left" | "center" | "right"; border?: boolean; wrap?: boolean }) => {
    cell.font = { name: FONT, size: opts.size ?? 9.5, bold: opts.bold, color: { argb: opts.color ?? INK } };
    if (opts.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill } };
    cell.alignment = { vertical: "middle", horizontal: opts.align ?? "left", wrapText: opts.wrap ?? true };
    if (opts.border) cell.border = thin;
  };
  const merge = (row: number, from: number, to: number, value: string, opts: Parameters<typeof style>[1] = {}) => {
    if (to > from) ws.mergeCells(row, from, row, to);
    const cell = ws.getCell(row, from);
    cell.value = value;
    style(cell, opts);
    if (opts.border) for (let c = from; c <= to; c++) ws.getCell(row, c).border = thin;
  };
  const section = (row: number, title: string) => {
    merge(row, 1, LAST, `■ ${title}`, { bold: true, size: 10.5, color: "FFFFFFFF", fill: INK });
    ws.getRow(row).height = 20;
  };

  let r = 1;
  merge(r, 1, LAST, "スキルシート", { bold: true, size: 16, align: "center" });
  ws.getRow(r).height = 30;
  r++;
  merge(r, 1, LAST, `作成日：${d.createdAt}`, { size: 9, align: "right", color: "FF666666" });
  r += 2;

  // 基本情報（2項目ずつ横に並べる）
  section(r++, "基本情報");
  for (let i = 0; i < d.basics.length; i += 2) {
    const pair = d.basics.slice(i, i + 2);
    merge(r, 1, 2, pair[0][0], { bold: true, fill: PAPER, border: true });
    merge(r, 3, 3, pair[0][1], { border: true });
    if (pair[1]) {
      merge(r, 4, 4, pair[1][0], { bold: true, fill: PAPER, border: true });
      merge(r, 5, LAST, pair[1][1], { border: true });
    }
    ws.getRow(r).height = 20;
    r++;
  }
  r++;

  // スキル要約
  section(r++, "スキル要約（経験年数・★は特に得意）");
  for (const g of d.skillGroups) {
    const text = g.skills.map((s) => `${s.strong ? "★" : ""}${s.name}（${s.years}年）`).join("　");
    merge(r, 1, 2, g.category, { bold: true, fill: PAPER, border: true });
    merge(r, 3, LAST, text, { border: true });
    ws.getRow(r).height = Math.max(20, lineCount(text, 110) * 15);
    r++;
  }
  if (d.qualifications.length > 0) {
    merge(r, 1, 2, "資格", { bold: true, fill: PAPER, border: true });
    merge(r, 3, LAST, d.qualifications.join("\n"), { border: true });
    ws.getRow(r).height = Math.max(20, d.qualifications.length * 15);
    r++;
  }
  r++;

  // 自己PR
  if (d.pr.length > 0) {
    section(r++, "自己PR");
    const text = d.pr.map((p) => `・${p}`).join("\n");
    merge(r, 1, LAST, text, { border: true });
    ws.getRow(r).height = Math.max(22, lineCount(text, 150) * 15 + 6);
    r += 2;
  }

  // 職務経歴
  section(r++, "職務経歴");
  const headers = ["No", "期間", "業務内容", "役割・規模", "環境", ...d.phaseHeaders];
  headers.forEach((h, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = h;
    style(cell, { bold: true, fill: PAPER, align: "center", border: true, size: i >= 5 ? 8.5 : 9.5 });
  });
  ws.getRow(r).height = 22;
  const headerRow = r;
  r++;
  for (const e of d.experiences) {
    const content = [
      `【${e.title}】${e.industry ? `（${e.industry}）` : ""}`,
      e.overview ? `概要：${e.overview}` : "",
      e.tasks ? `担当：${e.tasks}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const env = e.env.map((x) => `${x.label}：${x.value}`).join("\n");
    const values = [String(e.no), `${e.period}\n（${e.duration}）`, content, [e.role, e.teamSize].filter(Boolean).join("\n"), env];
    values.forEach((v, i) => {
      const cell = ws.getCell(r, i + 1);
      cell.value = v;
      style(cell, { border: true, align: i === 0 ? "center" : "left", size: i === 2 || i === 4 ? 9 : 9.5 });
      cell.alignment = { ...cell.alignment, vertical: "top" };
    });
    e.phases.forEach((on, i) => {
      const cell = ws.getCell(r, 6 + i);
      cell.value = on ? "●" : "";
      style(cell, { border: true, align: "center" });
    });
    ws.getRow(r).height = Math.max(40, Math.max(lineCount(content, COLS[2]), lineCount(env, COLS[4]), 2) * 14 + 8);
    r++;
  }
  ws.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  // 日本語のファイル名はヘッダーに直接使えないため、RFC 5987 形式でエンコードする
  const encoded = encodeURIComponent(`スキルシート_${d.displayName}.xlsx`);
  res.setHeader("Content-Disposition", `attachment; filename="skillsheet.xlsx"; filename*=UTF-8''${encoded}`);
  await wb.xlsx.write(res);
  res.end();
}
