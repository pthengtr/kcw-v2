import { z } from "zod";

import {
  BANK_MATCH_STATUSES,
  isBankMatchedRefType,
  normalizeBankMatchedRefType,
} from "@/lib/bank/match-status";

/**
 * Comma-separated document ids. One HQ receipt-voucher month
 * (`RV69MM-NNN` × ~40 bills) is about 500 characters, so the old 200
 * cap rejected a manual RV match as "Invalid body".
 */
export const STATEMENT_MATCHED_REF_ID_MAX = 4000;

export const statementLinePatchSchema = z
  .object({
    match_status: z.enum(BANK_MATCH_STATUSES).optional(),
    match_reason: z.string().trim().max(500).nullable().optional(),
    match_notes: z.string().trim().max(4000).nullable().optional(),
    report_remark: z.string().trim().max(1000).nullable().optional(),
    matched_ref_type: z
      .string()
      .trim()
      .max(100)
      .nullable()
      .optional()
      .transform((v) => {
        if (v == null || v === "") return v;
        return normalizeBankMatchedRefType(v) ?? v.toLowerCase();
      })
      .refine((v) => v == null || v === "" || isBankMatchedRefType(v), {
        message: "Unknown matched_ref_type",
      }),
    matched_ref_id: z
      .string()
      .trim()
      .max(STATEMENT_MATCHED_REF_ID_MAX)
      .nullable()
      .optional(),
  })
  .refine(
    (body) =>
      body.match_status !== undefined ||
      body.match_reason !== undefined ||
      body.match_notes !== undefined ||
      body.report_remark !== undefined ||
      body.matched_ref_type !== undefined ||
      body.matched_ref_id !== undefined,
    { message: "No match fields to update" }
  );

export function statementLinePatchError(error: z.ZodError): string {
  const flat = error.flatten();
  const refId = flat.fieldErrors.matched_ref_id?.[0];
  if (refId) {
    return `รหัสอ้างอิงยาวเกิน ${STATEMENT_MATCHED_REF_ID_MAX} ตัวอักษร`;
  }
  const refType = flat.fieldErrors.matched_ref_type?.[0];
  if (refType) return "ประเภทการจับคู่ไม่รู้จัก";
  const firstField = Object.values(flat.fieldErrors).find(
    (msgs) => msgs && msgs.length > 0
  )?.[0];
  return firstField || flat.formErrors[0] || "Invalid body";
}
