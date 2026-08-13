import { describe, expect, it } from "vitest";

import { parseProductImageKpi, parseProductImageSummary } from "./queries";
import { productImageEventLabel } from "./types";

describe("parseProductImageSummary", () => {
  it("parses numeric fields", () => {
    expect(
      parseProductImageSummary({
        uploads: "2",
        replaces: 1,
        deletes: 0,
        total_actions: 3,
        unique_products: 2,
      })
    ).toEqual({
      uploads: 2,
      replaces: 1,
      deletes: 0,
      total_actions: 3,
      unique_products: 2,
    });
  });
});

describe("parseProductImageKpi", () => {
  it("parses operators and activity", () => {
    const kpi = parseProductImageKpi({
      from: "2026-08-07",
      to: "2026-08-13",
      today: "2026-08-13",
      as_of: "2026-08-13T12:00:00+07:00",
      summary_today: { uploads: 1, total_actions: 1, unique_products: 1 },
      summary_range: { uploads: 5, replaces: 1, total_actions: 6 },
      operators: [
        {
          line_user_id: "U9",
          display_name: "Bee",
          total_today: 1,
          uploads_today: 1,
          total_actions: 6,
          unique_products: 4,
        },
      ],
      activity: [
        {
          created_at: "2026-08-13T05:00:00Z",
          display_name: "Bee",
          line_user_id: "U9",
          event_type: "image_upload",
          bcode: "22010585",
          storage_path: "product/22010585/22010585.jpg",
        },
      ],
    });

    expect(kpi.from).toBe("2026-08-07");
    expect(kpi.summary_today.uploads).toBe(1);
    expect(kpi.summary_range.total_actions).toBe(6);
    expect(kpi.operators[0]?.display_name).toBe("Bee");
    expect(kpi.activity[0]?.bcode).toBe("22010585");
  });

  it("tolerates empty payload", () => {
    const kpi = parseProductImageKpi({});
    expect(kpi.operators).toEqual([]);
    expect(kpi.activity).toEqual([]);
    expect(kpi.summary_today.deletes).toBe(0);
  });
});

describe("productImageEventLabel", () => {
  it("maps known event types", () => {
    expect(productImageEventLabel("image_upload")).toBe("อัปโหลด");
    expect(productImageEventLabel("image_replace")).toBe("แทนที่");
    expect(productImageEventLabel("image_delete")).toBe("ลบ");
    expect(productImageEventLabel("other")).toBe("other");
  });
});
