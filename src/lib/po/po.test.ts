import { describe, expect, it } from "vitest";

import { isWorkerOnline, WORKER_ONLINE_WINDOW_MS } from "@/lib/po/worker-jobs";
import {
  billedLabel,
  formatPoAmount,
  formatPoDate,
} from "@/lib/po/format";
import { PO_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { canAccessPoStatus } from "@/lib/auth/client-permissions";

describe("PO worker helpers", () => {
  it("treats heartbeat within window as online", () => {
    const now = Date.parse("2026-07-27T20:00:00.000Z");
    expect(
      isWorkerOnline(new Date(now - WORKER_ONLINE_WINDOW_MS + 1000).toISOString(), now)
    ).toBe(true);
    expect(
      isWorkerOnline(new Date(now - WORKER_ONLINE_WINDOW_MS - 1000).toISOString(), now)
    ).toBe(false);
    expect(isWorkerOnline(null, now)).toBe(false);
  });
});

describe("PO format helpers", () => {
  it("formats amounts and billed labels", () => {
    expect(formatPoAmount("1234.5")).toContain("1,234.50");
    expect(formatPoAmount(null)).toBe("—");
    expect(formatPoDate("2026-07-27")).toBe("2026-07-27");
    expect(billedLabel("N")).toBe("เปิด");
    expect(billedLabel("Y")).toBe("รับแล้ว");
  });
});

describe("PO RBAC", () => {
  it("exposes po_status page key", () => {
    expect(PO_PAGE_KEYS.status).toBe("po_status");
    expect(canAccessPoStatus(["*"])).toBe(true);
    expect(canAccessPoStatus(["po_status"])).toBe(true);
    expect(canAccessPoStatus(["bi_sales"])).toBe(false);
  });
});
