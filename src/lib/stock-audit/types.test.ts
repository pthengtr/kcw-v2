import { describe, expect, it } from "vitest";

import { STOCK_AUDIT_BUCKETS, bucketMeta } from "./types";

describe("stock audit bucket meta", () => {
  it("covers all dashboard buckets", () => {
    expect(STOCK_AUDIT_BUCKETS.map((b) => b.key)).toEqual([
      "never",
      "over_365",
      "d365",
      "d180",
      "d90",
      "d30",
    ]);
  });

  it("returns meta for known and fallback bucket", () => {
    expect(bucketMeta("over_365").label).toContain("1 ปี");
    expect(bucketMeta("d30").chip).toContain("emerald");
    expect(bucketMeta("never").label).toContain("ยังไม่เคย");
  });
});
