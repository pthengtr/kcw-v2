const DOC_TYPES = [
  "3CNTAR",
  "CNTAR",
  "3TAR",
  "TAR",
  "3CNTAD",
  "CNTAD",
  "3TAD",
  "TAD",
  "3TR",
  "TR",
  "3TD",
  "TD",
  "3CN",
  "CN",
] as const;

export type SalesBillDocType = (typeof DOC_TYPES)[number];

/** Canonical bill family for the detail lookup. Prefix order matters. */
export function normalizeSalesBillDocType(
  billno: string,
  docType?: string | null
): SalesBillDocType {
  const explicit = (docType ?? "").trim().toUpperCase();
  if ((DOC_TYPES as readonly string[]).includes(explicit)) {
    return explicit as SalesBillDocType;
  }
  const bill = billno.trim().toUpperCase();
  for (const prefix of DOC_TYPES) {
    if (bill.startsWith(prefix)) return prefix;
  }
  return "TAD";
}
