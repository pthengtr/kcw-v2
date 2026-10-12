export const VAT_REGISTER_COLUMNS = [
  { id: "index", label: "ลำดับ" },
  { id: "date", label: "วันที่" },
  { id: "bill", label: "เลขที่" },
  { id: "party", label: "ชื่อคู่ค้า" },
  { id: "taxId", label: "เลขผู้เสียภาษี" },
  { id: "before", label: "มูลค่าสินค้า", money: true },
  { id: "vat", label: "ภาษีมูลค่าเพิ่ม", money: true },
  { id: "after", label: "ยอดสุทธิ", money: true },
  { id: "detail", label: "รายการสินค้า" },
  { id: "status", label: "สถานะ", paymentOnly: true },
  { id: "docs", label: "เอกสาร" },
] as const;

export type VatRegisterColumn = (typeof VAT_REGISTER_COLUMNS)[number];
export type VatRegisterColumnId = VatRegisterColumn["id"];

const COLUMN_IDS = new Set<string>(VAT_REGISTER_COLUMNS.map((column) => column.id));

export function isVatRegisterColumnId(value: unknown): value is VatRegisterColumnId {
  return typeof value === "string" && COLUMN_IDS.has(value);
}

function columnAvailable(column: VatRegisterColumn, showPayment: boolean): boolean {
  return !("paymentOnly" in column && column.paymentOnly) || showPayment;
}

/** Columns the user can show for this sheet, ignoring a selection that would hide every column. */
export function visibleVatRegisterColumns(
  hidden: readonly string[],
  showPayment: boolean
): VatRegisterColumn[] {
  const available = VAT_REGISTER_COLUMNS.filter((column) =>
    columnAvailable(column, showPayment)
  );
  const selected = available.filter((column) => !hidden.includes(column.id));
  return selected.length > 0 ? selected : available;
}

export type VatFooterPiece =
  | { type: "label"; span: number }
  | { type: "money"; id: "before" | "vat" | "after" }
  | { type: "gap"; span: number };

const MONEY_IDS = new Set<string>(["before", "vat", "after"]);

/** Footer cells that stay under the same columns as the body. */
export function vatRegisterFooterPieces(ids: readonly string[]): VatFooterPiece[] {
  const pieces: VatFooterPiece[] = [];
  let index = 0;
  let lead = 0;
  while (index < ids.length && !MONEY_IDS.has(ids[index]!)) {
    lead += 1;
    index += 1;
  }
  if (lead > 0) pieces.push({ type: "label", span: lead });
  while (index < ids.length) {
    const id = ids[index]!;
    if (id === "before" || id === "vat" || id === "after") {
      pieces.push({ type: "money", id });
      index += 1;
      continue;
    }
    let span = 0;
    while (index < ids.length && !MONEY_IDS.has(ids[index]!)) {
      span += 1;
      index += 1;
    }
    if (span > 0) pieces.push({ type: "gap", span });
  }
  return pieces;
}
