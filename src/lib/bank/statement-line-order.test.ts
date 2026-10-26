import { describe, expect, it } from "vitest";

import {
  buildAccountSheets,
  compareStatementLinesLatestFirst,
  enrichStatementRows,
  statementTxnTimeSeconds,
  type StatementLineRow,
} from "@/lib/bank/statement-report-format";

function line(
  overrides: Partial<StatementLineRow> & { txn_date: string },
): StatementLineRow {
  return {
    account_no: "141-1-72355-7",
    bank_name: "KBANK",
    value_date: null,
    description: "โอนเงิน",
    bank_reference: null,
    amount: 1,
    direction: "out",
    debit: 1,
    credit: null,
    balance_after: null,
    raw_json: {},
    source_row_number: null,
    source_file_id: null,
    match_status: "matched",
    match_reason: null,
    match_notes: null,
    report_remark: null,
    matched_ref_type: null,
    matched_ref_id: null,
    match_confidence: null,
    original_filename: null,
    ...overrides,
  };
}

describe("statement line order", () => {
  it("reads the bank clock from the Excel time serial", () => {
    expect(
      statementTxnTimeSeconds({
        "เวลา/ วันที่มีผล": "1899-12-30T16:23:00.000Z",
      }),
    ).toBe(16 * 3600 + 23 * 60);
    expect(statementTxnTimeSeconds({ เวลา: "09:05" })).toBe(9 * 3600 + 5 * 60);
  });

  it("puts the latest date and the latest time on top", () => {
    const rows = [
      line({
        txn_date: "2026-10-06",
        debit: 3210,
        source_row_number: 19,
        raw_json: { "เวลา/ วันที่มีผล": "1899-12-30T13:55:00.000Z" },
      }),
      line({
        txn_date: "2026-10-07",
        debit: 100,
        source_row_number: 21,
        raw_json: { "เวลา/ วันที่มีผล": "1899-12-30T10:30:00.000Z" },
      }),
      line({
        txn_date: "2026-10-06",
        debit: 900,
        source_row_number: 20,
        raw_json: { "เวลา/ วันที่มีผล": "1899-12-30T16:23:00.000Z" },
      }),
    ];

    const sorted = [...rows].sort(compareStatementLinesLatestFirst);
    expect(sorted.map((row) => row.debit)).toEqual([100, 900, 3210]);

    const sheets = buildAccountSheets(enrichStatementRows(rows));
    const sheet = [...sheets.values()][0];
    expect(sheet.map((row) => row["ถอนเงิน"])).toEqual([100, 900, 3210]);
  });
});
