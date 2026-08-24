/**
 * Port of notebooks/02_bank_statement_import_test.ipynb + src/kcw/bank_statement.py
 * parser_version: auto_v2 (canonical transaction fingerprints; display description excluded)
 *
 * Supports KBANK Thai exports and both KTB layouts, including multi-tab workbooks
 * (one sheet per account, e.g. `248-0-42113-9` + `248-6-00618-4`).
 */
import * as XLSX from "npm:xlsx@0.18.5";
import { expandSheetRef } from "./sheet-range.ts";
import {
  inferAccountFromFilename,
  parseStatementSheets,
  PARSER_VERSION,
  type ParseResult,
} from "./parse-sheets.ts";

export { PARSER_VERSION, inferAccountFromFilename };
export { sha256HexAsync } from "./fingerprint.ts";
export type { ParsedLine, ParseResult, SheetParseSummary } from "./parse-sheets.ts";

function sheetToGrid(sheet: XLSX.WorkSheet): unknown[][] {
  // KTB DownLoadService .xls (OOXML misnamed) often stores a truncated !ref
  // (e.g. A1:I12) while the rest of the statement cells still exist.
  expandSheetRef(sheet as unknown as Record<string, unknown>);
  const ref = sheet["!ref"];
  if (!ref) return [];
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: true,
  }) as unknown[][];
}

export async function parseStatementBytes(
  bytes: Uint8Array,
  opts: {
    filename: string;
    bankName: string;
    accountNo?: string | null;
    source?: string;
  },
): Promise<ParseResult> {
  const wb = XLSX.read(bytes, {
    type: "array",
    cellDates: true,
    raw: true,
  });

  const sheets = wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    return {
      name,
      grid: sheet ? sheetToGrid(sheet) : [],
    };
  });

  return parseStatementSheets(sheets, opts);
}
