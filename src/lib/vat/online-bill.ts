/** Online abbreviated tax invoices share the live ขายออนไลน์ print sheet. */
export const ONLINE_TAX_SHEETS = new Set(["TAD", "CNTAD", "3TAD", "3CNTAD"]);

export function isOnlineTaxVatBill(sheet: string): boolean {
  return ONLINE_TAX_SHEETS.has(sheet);
}

export function onlineSalePrintKind(
  sheet: string,
  billNo: string
): "tad" | "cntad" | null {
  const exact = billNo.trim().toUpperCase();
  if (
    sheet === "CNTAD" ||
    sheet === "3CNTAD" ||
    exact.startsWith("CNTAD") ||
    exact.startsWith("3CNTAD")
  ) {
    return "cntad";
  }
  if (
    sheet === "TAD" ||
    sheet === "3TAD" ||
    exact.startsWith("TAD") ||
    exact.startsWith("3TAD")
  ) {
    return "tad";
  }
  return null;
}
