import { crc32, deflateRawSync } from "node:zlib";

import ExcelJS from "exceljs";

import {
  vatRegisterWorkbookFiles,
  type VatCell,
  type VatExportScope,
  type VatWorkbookFile,
} from "@/lib/vat/register-excel";
import type { VatRegisterRow } from "@/lib/vat/register";

const MONEY_COLUMNS = new Set([
  "มูลค่าสินค้า",
  "ภาษีมูลค่าเพิ่ม",
  "ยอดสุทธิ",
  "AMOUNT",
  "VAT",
  "TOTAL",
]);

const thin: Partial<ExcelJS.Border> = { style: "thin" };
const border: Partial<ExcelJS.Borders> = {
  top: thin,
  left: thin,
  bottom: thin,
  right: thin,
};
const headerFill: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF3DFD2" },
};

function isMoneyColumn(name: string): boolean {
  const trimmed = name.trim();
  if (MONEY_COLUMNS.has(trimmed)) return true;
  const upper = trimmed.toUpperCase();
  return ["AMOUNT", "VAT", "TOTAL"].some((key) => upper.includes(key));
}

export async function writeVatWorkbook(file: VatWorkbookFile): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const sheet of file.sheets) {
    const ws = wb.addWorksheet(sheet.name);
    ws.mergeCells("A1:H1");
    const title = ws.getCell("A1");
    title.value = sheet.title;
    title.font = { bold: true, size: 14 };
    title.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    const labels: [string, string, string][] = [
      ["A3:C3", "D3:F3", "ชื่อสถานประกอบกิจการ"],
      ["A4:C4", "D4:F4", "ที่อยู่สถานประกอบกิจการ"],
      ["A5:C5", "D5:F5", "เลขประจำตัวผู้เสียภาษี"],
    ];
    const values = [file.company.name, file.company.address, file.company.taxId];
    labels.forEach(([labelRange, valueRange, label], index) => {
      ws.mergeCells(labelRange);
      ws.mergeCells(valueRange);
      const labelCell = ws.getCell(labelRange.split(":")[0]);
      const valueCell = ws.getCell(valueRange.split(":")[0]);
      labelCell.value = label;
      labelCell.font = { bold: true };
      labelCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      valueCell.value = values[index];
      valueCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    });

    const startRow = 7;
    sheet.columns.forEach((column, index) => {
      const cell = ws.getCell(startRow, index + 1);
      cell.value = column;
      cell.font = { bold: true };
      cell.fill = headerFill;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = border;
    });
    sheet.rows.forEach((row, rowIndex) => {
      row.forEach((value, columnIndex) => {
        const column = sheet.columns[columnIndex] ?? "";
        const cell = ws.getCell(startRow + 1 + rowIndex, columnIndex + 1);
        cell.value = value;
        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        cell.border = border;
        if (isMoneyColumn(column) && typeof value === "number") cell.numFmt = "#,##0.00";
        if (column === "วันที่" || column === "BILLDATE") cell.numFmt = "dd/mm/yyyy";
      });
    });
    ws.views = [{ state: "frozen", ySplit: startRow }];
    sheet.columns.forEach((column, index) => {
      const width = Math.min(columnWidth(column, sheet.rows, index), 60);
      ws.getColumn(index + 1).width = width;
    });
  }
  const raw = await wb.xlsx.writeBuffer();
  return Buffer.from(raw);
}

function columnWidth(column: string, rows: VatCell[][], index: number): number {
  let max = column.length;
  for (const row of rows) {
    const value = row[index];
    const length = value == null ? 0 : String(value).length;
    if (length > max) max = length;
  }
  return max + 2;
}

export type VatDownload = {
  filename: string;
  contentType: string;
  body: Buffer;
};

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function buildVatRegisterDownload(
  rows: VatRegisterRow[],
  scope: VatExportScope
): Promise<VatDownload | null> {
  const files = vatRegisterWorkbookFiles(rows, scope);
  if (files.length === 0) return null;
  if (files.length === 1) {
    const file = files[0];
    return {
      filename: file.filename,
      contentType: XLSX_TYPE,
      body: await writeVatWorkbook(file),
    };
  }
  const [year, month] = scope.month.split("-");
  const packed = await Promise.all(
    files.map(async (file) => ({
      name: file.filename,
      data: await writeVatWorkbook(file),
    }))
  );
  return {
    filename: `vat_reports_${year}_${month}.zip`,
    contentType: "application/zip",
    body: zipFiles(packed),
  };
}

function zipFiles(files: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const checksum = crc32(file.data);
    const compressed = deflateRawSync(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, compressed);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(0, 12);
    entry.writeUInt16LE(0, 14);
    entry.writeUInt32LE(checksum, 16);
    entry.writeUInt32LE(compressed.length, 20);
    entry.writeUInt32LE(file.data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt16LE(0, 30);
    entry.writeUInt16LE(0, 32);
    entry.writeUInt16LE(0, 34);
    entry.writeUInt16LE(0, 36);
    entry.writeUInt32LE(0, 38);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, centralBuf, end]);
}
