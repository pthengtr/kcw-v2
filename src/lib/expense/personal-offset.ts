export const EXPENSE_PERSONAL_OFFSET_CATEGORY_NAME = "หักส่วนตัวจากบิลบริษัท";
export const EXPENSE_PERSONAL_OFFSET_ITEM_NAME = "หักส่วนตัวจากบิลบริษัท";

export type ExpenseOffsetSummary = {
  claimed_opex: number;
  cn_opex: number;
  already_offset: number;
  remaining: number;
};

export function isPersonalOffsetRow(row: {
  ref_receipt_uuid?: string | null;
  unit_price: number;
  quantity: number;
}): boolean {
  return Boolean(row.ref_receipt_uuid) && row.unit_price * row.quantity < 0;
}

export function parseOffsetSummary(raw: unknown): ExpenseOffsetSummary {
  const data = (raw ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const parsed = Number(v);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  };
  return {
    claimed_opex: n(data.claimed_opex),
    cn_opex: n(data.cn_opex),
    already_offset: n(data.already_offset),
    remaining: n(data.remaining),
  };
}
