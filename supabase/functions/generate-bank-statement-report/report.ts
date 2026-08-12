/**
 * Monthly multi-account bank statement Excel report.
 * Presentation helpers live in `report-format.ts`; this file builds the workbook.
 */
import ExcelJS from "npm:exceljs@4.4.0";

export * from "./report-format.ts";

import {
  COLUMN_ORDER,
  COMPANY_ADDRESS,
  COMPANY_NAME,
  TAX_ID,
  type EnrichedRow,
  type ReportColumn,
} from "./report-format.ts";

const DONE_MATCH_STATUSES = new Set(["matched", "manual", "resolved"]);

function fillWarning(status: unknown): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return Boolean(s) && !DONE_MATCH_STATUSES.has(s);
}

export async function buildWorkbookBuffer(
  sheets: Map<string, EnrichedRow[]>,
  year: number,
  month: number,
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "kcw-v2";
  wb.created = new Date();

  const titleName = `รายงานเดินบัญชีธนาคาร ประจำเดือน ${String(month).padStart(2, "0")}/${year}`;
  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF3DFD2" },
  };
  const warningFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFF2CC" },
  };
  const thin: Partial<ExcelJS.Border> = {
    style: "thin",
    color: { argb: "FF000000" },
  };
  const border: Partial<ExcelJS.Borders> = {
    top: thin,
    left: thin,
    bottom: thin,
    right: thin,
  };

  const entries =
    sheets.size > 0
      ? [...sheets.entries()]
      : ([["NO_DATA", []]] as [string, EnrichedRow[]][]);

  for (const [sheetName, rows] of entries) {
    const ws = wb.addWorksheet(sheetName.slice(0, 31));
    const lastCol = Math.max(COLUMN_ORDER.length, 8);
    const endLetter = colLetter(lastCol);

    ws.mergeCells(`A1:${endLetter}1`);
    const titleCell = ws.getCell("A1");
    titleCell.value = `${titleName} — ${sheetName}`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    ws.mergeCells("A3:C3");
    ws.getCell("A3").value = "ชื่อสถานประกอบกิจการ";
    ws.getCell("A3").font = { bold: true };
    ws.mergeCells("D3:F3");
    ws.getCell("D3").value = COMPANY_NAME;

    ws.mergeCells("A4:C4");
    ws.getCell("A4").value = "ที่อยู่สถานประกอบกิจการ";
    ws.getCell("A4").font = { bold: true };
    ws.mergeCells("D4:F4");
    ws.getCell("D4").value = COMPANY_ADDRESS;

    ws.mergeCells("A5:C5");
    ws.getCell("A5").value = "เลขประจำตัวผู้เสียภาษี";
    ws.getCell("A5").font = { bold: true };
    ws.mergeCells("D5:F5");
    ws.getCell("D5").value = TAX_ID;

    const startRow = 7;
    const headerRow = ws.getRow(startRow);
    COLUMN_ORDER.forEach((col, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = col;
      cell.font = { bold: true };
      cell.fill = headerFill;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = border as ExcelJS.Borders;
    });

    let debitSum = 0;
    let creditSum = 0;
    rows.forEach((row, i) => {
      const excelRow = ws.getRow(startRow + 1 + i);
      const warn = fillWarning(row._match_status);
      const debit = typeof row.ถอนเงิน === "number" ? row.ถอนเงิน : 0;
      const credit = typeof row.ฝากเงิน === "number" ? row.ฝากเงิน : 0;
      debitSum += debit || 0;
      creditSum += credit || 0;

      COLUMN_ORDER.forEach((col, idx) => {
        const cell = excelRow.getCell(idx + 1);
        const value = row[col];
        if (col === "วันที่" && value instanceof Date) {
          cell.value = value;
          cell.numFmt = "dd/mm/yyyy";
        } else if (
          (col === "ถอนเงิน" || col === "ฝากเงิน" || col === "ยอดคงเหลือ") &&
          typeof value === "number"
        ) {
          cell.value = value;
          cell.numFmt = "#,##0.00";
        } else if (col === "#" && typeof value === "number") {
          cell.value = value;
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else if (value instanceof Date) {
          cell.value = value;
          cell.numFmt = "dd/mm/yyyy";
        } else if (value == null || value === "") {
          cell.value = null;
        } else {
          cell.value = value;
        }
        if (col !== "#") {
          cell.alignment = {
            horizontal:
              col === "ถอนเงิน" || col === "ฝากเงิน" || col === "ยอดคงเหลือ"
                ? "right"
                : "left",
            vertical: "middle",
            wrapText: true,
          };
        }
        cell.border = border as ExcelJS.Borders;
        if (warn) cell.fill = warningFill;
      });
    });

    // Total row
    const totalRowIdx = startRow + 1 + rows.length;
    const totalRow = ws.getRow(totalRowIdx);
    COLUMN_ORDER.forEach((col, idx) => {
      const cell = totalRow.getCell(idx + 1);
      if (col === "รายการ / ชื่อบริษัท") cell.value = "รวม";
      else if (col === "ถอนเงิน") {
        cell.value = debitSum;
        cell.numFmt = "#,##0.00";
      } else if (col === "ฝากเงิน") {
        cell.value = creditSum;
        cell.numFmt = "#,##0.00";
      } else {
        cell.value = "";
      }
      cell.border = border as ExcelJS.Borders;
      cell.alignment = {
        horizontal:
          col === "ถอนเงิน" || col === "ฝากเงิน" || col === "ยอดคงเหลือ"
            ? "right"
            : "left",
        vertical: "middle",
        wrapText: true,
      };
    });

    ws.views = [{ state: "frozen", ySplit: startRow }];

    const defaultWidths: Record<ReportColumn, number> = {
      "#": 5,
      วันที่: 12,
      "รายการ / ชื่อบริษัท": 36,
      เลขที่บิล: 16,
      ถอนเงิน: 14,
      ฝากเงิน: 14,
      ยอดคงเหลือ: 14,
      หมายเหตุ: 18,
    };

    COLUMN_ORDER.forEach((col, idx) => {
      let maxLen = Math.max(String(col).length, defaultWidths[col] ?? 10);
      for (const row of rows) {
        const v = row[col];
        const len = v == null ? 0 : String(v).length;
        if (len > maxLen) maxLen = len;
      }
      ws.getColumn(idx + 1).width = Math.min(maxLen + 2, 60);
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

function colLetter(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}
