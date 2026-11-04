import { describe, expect, it } from "vitest";

import {
  STATEMENT_MATCHED_REF_ID_MAX,
  statementLinePatchError,
  statementLinePatchSchema,
} from "@/lib/bank/statement-line-patch";

function rvMonthRefs(count: number): string {
  return Array.from(
    { length: count },
    (_, i) => `RV6905-${String(i + 1).padStart(3, "0")}`
  ).join(",");
}

describe("statement line patch body", () => {
  it("accepts a full HQ RV month on a manual match", () => {
    const matched_ref_id = rvMonthRefs(47);
    expect(matched_ref_id.length).toBeGreaterThan(200);
    expect(matched_ref_id.length).toBeLessThan(STATEMENT_MATCHED_REF_ID_MAX);

    const parsed = statementLinePatchSchema.safeParse({
      match_status: "manual",
      match_reason: "คืนเงินอะไหล่ (ใบสำคัญรับเงิน)",
      matched_ref_type: "rvmas",
      matched_ref_id,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.matched_ref_type).toBe("rvmas");
    expect(parsed.data.matched_ref_id).toBe(matched_ref_id);
  });

  it("rejects a reference list past the cap with a readable error", () => {
    const parsed = statementLinePatchSchema.safeParse({
      match_status: "manual",
      match_reason: "คืนเงินอะไหล่ (ใบสำคัญรับเงิน)",
      matched_ref_type: "rvmas",
      matched_ref_id: "R".repeat(STATEMENT_MATCHED_REF_ID_MAX + 1),
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(statementLinePatchError(parsed.error)).toContain("รหัสอ้างอิง");
  });
});
