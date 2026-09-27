import ExcelJS from "exceljs";
import { Response } from "express";
import { groupSkillsByCategory } from "./skillCategory";

export interface SkillSheetExcelData {
  name: string;
  age: number | null;
  nearestStation: string | null;
  availability: string | null;
  desiredRate: number | null;
  totalExperienceYears: number | null;
  workProcesses: string[];
  appealPoints: string[];
  remarks: string | null;
  skills: { name: string; level: number; years: number }[];
  experiences: { title: string; period: string; role: string; tech: string; description: string }[];
}

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF4338CA" },
};

function sectionHeader(sheet: ExcelJS.Worksheet, row: number, title: string, span = 5) {
  sheet.mergeCells(row, 1, row, span);
  const cell = sheet.getCell(row, 1);
  cell.value = title;
  cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  cell.fill = HEADER_FILL;
  cell.alignment = { vertical: "middle" };
  sheet.getRow(row).height = 22;
}

export async function streamSkillSheetExcel(res: Response, data: SkillSheetExcelData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ソトバ";
  const sheet = workbook.addWorksheet("スキルシート");
  sheet.columns = [{ width: 16 }, { width: 22 }, { width: 16 }, { width: 22 }, { width: 40 }];

  let row = 1;

  // ■ 基本情報
  sectionHeader(sheet, row++, "■ 基本情報");
  const basicRows: [string, string][] = [
    ["氏名", data.name],
    ["年齢", data.age ? `${data.age}歳` : "-"],
    ["最寄駅", data.nearestStation ?? "-"],
    ["稼働開始", data.availability ?? "応相談"],
    ["希望単価", data.desiredRate ? `${data.desiredRate.toLocaleString()}円〜` : "応相談"],
    ["IT経験年数", data.totalExperienceYears ? `約${data.totalExperienceYears}年` : "-"],
  ];
  for (const [label, value] of basicRows) {
    sheet.getCell(row, 1).value = label;
    sheet.getCell(row, 1).font = { bold: true };
    sheet.mergeCells(row, 2, row, 5);
    sheet.getCell(row, 2).value = value;
    row++;
  }
  row++;

  // ■ スキルサマリー
  sectionHeader(sheet, row++, "■ スキルサマリー（★＝特に強い領域）");
  const grouped = groupSkillsByCategory(data.skills);
  for (const group of grouped) {
    sheet.getCell(row, 1).value = group.category;
    sheet.getCell(row, 1).font = { bold: true };
    const skillsText = group.skills
      .map((s) => `${s.strong ? "★" : ""}${s.name}(${s.years}年)`)
      .join(" / ");
    sheet.mergeCells(row, 2, row, 5);
    sheet.getCell(row, 2).value = skillsText;
    sheet.getCell(row, 2).alignment = { wrapText: true };
    row++;
  }
  row++;

  // ■ 対応可能工程
  sectionHeader(sheet, row++, "■ 対応可能工程");
  sheet.mergeCells(row, 1, row, 5);
  sheet.getCell(row, 1).value = data.workProcesses.length > 0 ? data.workProcesses.join(" → ") : "-";
  sheet.getCell(row, 1).alignment = { wrapText: true };
  row += 2;

  // ■ アピールポイント
  sectionHeader(sheet, row++, "■ アピールポイント");
  for (const [i, point] of data.appealPoints.entries()) {
    sheet.mergeCells(row, 1, row, 5);
    const cell = sheet.getCell(row, 1);
    cell.value = `${i + 1}. ${point}`;
    cell.alignment = { wrapText: true };
    sheet.getRow(row).height = 32;
    row++;
  }
  row++;

  // ■ 経歴一覧
  sectionHeader(sheet, row++, "■ 経歴一覧");
  const expHeader = sheet.getRow(row);
  expHeader.values = ["期間", "案件名", "役割", "使用技術", "内容"];
  expHeader.font = { bold: true };
  expHeader.eachCell((cell) => {
    cell.border = { bottom: { style: "thin" } };
  });
  row++;
  for (const exp of data.experiences) {
    sheet.getCell(row, 1).value = exp.period;
    sheet.getCell(row, 2).value = exp.title;
    sheet.getCell(row, 3).value = exp.role;
    sheet.getCell(row, 4).value = exp.tech;
    sheet.getCell(row, 5).value = exp.description;
    sheet.getCell(row, 5).alignment = { wrapText: true };
    row++;
  }
  row++;

  // ■ 備考／PR
  if (data.remarks) {
    sectionHeader(sheet, row++, "■ 備考／PR");
    sheet.mergeCells(row, 1, row, 5);
    sheet.getCell(row, 1).value = data.remarks;
    sheet.getCell(row, 1).alignment = { wrapText: true };
    sheet.getRow(row).height = 60;
    row++;
  }

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  // 氏名に日本語が含まれるとヘッダーに直接使えないため、RFC 5987 形式でエンコードする
  const encodedFilename = encodeURIComponent(`skillsheet_${data.name}.xlsx`);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="skillsheet.xlsx"; filename*=UTF-8''${encodedFilename}`
  );

  await workbook.xlsx.write(res);
  res.end();
}
