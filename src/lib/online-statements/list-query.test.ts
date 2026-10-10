import { describe, expect, it } from "vitest";

import {
  defaultSortAscending,
  parseOnlinePayoutListQuery,
  payoutAtLowerBound,
  payoutAtUpperBound,
} from "@/lib/online-statements/list-query";

describe("online payout list query", () => {
  it("keeps the recent transferred list when filters are empty", () => {
    expect(parseOnlinePayoutListQuery(new URLSearchParams())).toEqual({
      platform: "all",
      status: "transferred",
      shop: "",
      from: "",
      to: "",
      sort: "payout_at",
      ascending: false,
      limit: 500,
    });
  });

  it("accepts a shop, a period, and a sort", () => {
    const query = parseOnlinePayoutListQuery(
      new URLSearchParams({
        platform: "lazada",
        shop: "LAZ1",
        from: "2026-10-01",
        to: "2026-10-31",
        sort: "amount",
        dir: "asc",
      })
    );
    expect(query).toMatchObject({
      platform: "lazada",
      shop: "LAZ1",
      from: "2026-10-01",
      to: "2026-10-31",
      sort: "amount",
      ascending: true,
      limit: 5000,
    });
    expect(payoutAtLowerBound(query.from)).toBe("2026-10-01T00:00:00+07:00");
    expect(payoutAtUpperBound(query.to)).toBe("2026-11-01T00:00:00+07:00");
  });

  it("drops invalid dates and shops, and swaps an inverted range", () => {
    const query = parseOnlinePayoutListQuery(
      new URLSearchParams({
        shop: "ร้าน 1",
        from: "2026-12-31",
        to: "2026-02-31",
        sort: "drop table",
        dir: "desc",
      })
    );
    expect(query.shop).toBe("");
    expect(query.from).toBe("2026-12-31");
    expect(query.to).toBe("");
    expect(query.sort).toBe("payout_at");
    expect(query.ascending).toBe(false);
    expect(query.limit).toBe(5000);

    const swapped = parseOnlinePayoutListQuery(
      new URLSearchParams({ from: "2026-10-20", to: "2026-10-01" })
    );
    expect(swapped.from).toBe("2026-10-01");
    expect(swapped.to).toBe("2026-10-20");
    expect(payoutAtUpperBound("2026-12-31")).toBe("2027-01-01T00:00:00+07:00");
  });

  it("sorts names ascending and amounts descending by default", () => {
    expect(defaultSortAscending("shop")).toBe(true);
    expect(defaultSortAscending("amount")).toBe(false);
    expect(defaultSortAscending("payout_at")).toBe(false);
  });
});
