/**
 * Statement column resolution for KBANK / KTB Excel layouts.
 * Kept free of xlsx so vitest can cover old DownLoadService + Thai Corporate Online.
 */

import { TRANSACTION_DETAIL_COL_PATTERNS, normText } from "./fingerprint.ts";

export type ResolvedColumns = {
  colDate: string | null;
  colValueDate: string | null;
  colDesc: string | null;
  colTxnDetail: string | null;
  colDebit: string | null;
  colCredit: string | null;
  colAmount: string | null;
  colBalance: string | null;
  colRef: string | null;
};

export function normCols(cols: unknown[]): string[] {
  const out = cols.map((c) => normText(c));
  const seen: Record<string, number> = {};
  return out.map((c) => {
    if (!(c in seen)) {
      seen[c] = 0;
      return c;
    }
    seen[c] += 1;
    return `${c}_${seen[c]}`;
  });
}

export function pickCol(cols: string[], patterns: string[]): string | null {
  for (const p of patterns) {
    const rx = new RegExp(p);
    for (const c of cols) {
      if (rx.test(c)) return c;
    }
  }
  return null;
}

export function isSignedCombinedAmountCol(col: string): boolean {
  return /ถอน.*ฝาก|ฝาก.*ถอน|WITHDRAW.*DEPOSIT|DEPOSIT.*WITHDRAW/.test(col);
}

/**
 * Map header cells to logical statement columns.
 * KTB Thai Corporate Online uses signed `ถอนเงิน/ฝากเงิน` (must not dual-bind debit+credit).
 */
export function resolveStatementColumns(headerCells: unknown[]): ResolvedColumns {
  const cols = normCols(headerCells);

  const colDate = pickCol(cols, [
    "^DATE$",
    "TXN.*DATE",
    "TRAN.*DATE",
    "^วันที่$",
    "วันที่",
  ]);
  const colValueDate = pickCol(cols, ["VALUE.*DATE", "VAL.*DATE", "วันที่.*เงิน"]);
  // Prefer exact รายการ so we do not steal รายละเอียด; DESCRIPTION before bare DESC.
  const colDesc = pickCol(cols, [
    "^DESCRIPTION$",
    "^DESC$",
    "^DETAIL$",
    "^PARTICULAR$",
    "^รายการ$",
    "^รายละเอียด$",
  ]);
  const colTxnDetail = pickCol(cols, TRANSACTION_DETAIL_COL_PATTERNS);

  let colDebit = pickCol(cols, ["DEBIT", "WITHDRAW", "^DR$", "ถอน", "เดบิต"]);
  let colCredit = pickCol(cols, ["CREDIT", "DEPOSIT", "^CR$", "ฝาก", "เครดิต"]);
  let colAmount = pickCol(cols, [
    "^AMOUNT$",
    "^จำนวนเงิน$",
    "ถอน.*ฝาก",
    "ฝาก.*ถอน",
    "WITHDRAW.*DEPOSIT",
    "DEPOSIT.*WITHDRAW",
  ]);

  // Same column matched as both debit and credit (e.g. ถอนเงิน/ฝากเงิน) → signed amount.
  if (colDebit && colCredit && colDebit === colCredit) {
    if (!colAmount) colAmount = colDebit;
    colDebit = null;
    colCredit = null;
  } else if (colAmount && isSignedCombinedAmountCol(colAmount)) {
    // Prefer signed path; clear debit/credit if they pointed at the same combined col.
    if (colDebit === colAmount) colDebit = null;
    if (colCredit === colAmount) colCredit = null;
  }

  const colBalance = pickCol(cols, ["BAL", "BALANCE", "คงเหลือ", "ยอดคงเหลือ"]);
  const colRef = pickCol(cols, [
    "REF",
    "REFERENCE",
    "CHEQUE",
    "CHQ",
    "หมายเลขเช็ค",
    "เลขที่",
    "อ้างอิง",
    "^CHEQUE NO",
  ]);

  return {
    colDate,
    colValueDate,
    colDesc,
    colTxnDetail,
    colDebit,
    colCredit,
    colAmount,
    colBalance,
    colRef,
  };
}

export function columnsAreUsable(resolved: ResolvedColumns): boolean {
  return Boolean(
    resolved.colDate &&
      (resolved.colDebit || resolved.colCredit || resolved.colAmount),
  );
}
