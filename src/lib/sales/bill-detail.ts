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

/**
 * Bill-header discount that is not already inside the line amounts.
 * Returns the baht amount to show as a ส่วนลด line, or null when the
 * lines already match the pre-tax total.
 */
export function billDiscountToShow(
  lineSum: number,
  beforetax: number,
  discount: number
): number | null {
  if (!Number.isFinite(discount) || Math.abs(discount) < 0.005) return null;
  if (!Number.isFinite(lineSum) || !Number.isFinite(beforetax)) return null;
  const gap = Math.round((lineSum - beforetax) * 100) / 100;
  const disc = Math.round(discount * 100) / 100;
  if (Math.abs(gap - disc) <= 0.05) return disc;
  return null;
}
