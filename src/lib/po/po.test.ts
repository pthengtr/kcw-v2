import { describe, expect, it } from "vitest";

import {
  ICLOW_SYNC_JOB_TYPE,
  ICLOW_SYNC_SITES,
  INVENTORY_SYNC_JOB_TYPE,
  INVENTORY_SYNC_SITES,
  isWorkerOnline,
  PO_RELATED_SYNC_JOB_TYPE,
  PO_RELATED_SYNC_SITES,
  WORKER_ONLINE_WINDOW_MS,
  workerNameForSite,
} from "@/lib/po/worker-jobs";
import {
  billedLabel,
  formatPoAmount,
  formatPoDate,
  formatPoQty,
  prepareStatusBadgeClassName,
  prepareStatusLabel,
} from "@/lib/po/format";
import {
  PO_ICLOW_STATUS_TABS,
  PO_PENDING_RECEIVE_STATUSES,
} from "@/lib/po/po-queries";
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

  it("maps inventory sync to both site workers", () => {
    expect(INVENTORY_SYNC_JOB_TYPE).toBe("sync_inventory");
    expect(INVENTORY_SYNC_SITES).toEqual(["HQ", "SYP"]);
    expect(workerNameForSite("HQ")).toBe("HQ-PC");
    expect(workerNameForSite("SYP")).toBe("SYP-PC");
  });

  it("maps ICLOW sync to both site workers", () => {
    expect(ICLOW_SYNC_JOB_TYPE).toBe("sync_iclow");
    expect(ICLOW_SYNC_SITES).toEqual(["HQ", "SYP"]);
  });

  it("maps PO-related sync to both site workers", () => {
    expect(PO_RELATED_SYNC_JOB_TYPE).toBe("sync_po_related");
    expect(PO_RELATED_SYNC_SITES).toEqual(["HQ", "SYP"]);
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

  it("formats inventory qty", () => {
    expect(formatPoQty("12.5")).toBe("12.5");
    expect(formatPoQty(0)).toBe("0");
    expect(formatPoQty(null)).toBe("—");
  });

  it("labels prepare status from TF/SIMas", () => {
    expect(prepareStatusLabel("prepared")).toBe("เตรียมแล้ว");
    expect(prepareStatusLabel("partially_prepared")).toBe("เตรียมบางส่วน");
    expect(prepareStatusLabel("not_prepared")).toBe("ยังไม่เตรียม");
    expect(prepareStatusBadgeClassName("prepared")).toContain("emerald");
    expect(prepareStatusBadgeClassName("partially_prepared")).toContain("amber");
    expect(prepareStatusBadgeClassName("not_prepared")).toContain("slate");
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

describe("PO pending receive statuses", () => {
  it("lists ICLOW-backed UI statuses", () => {
    expect(PO_PENDING_RECEIVE_STATUSES).toEqual([
      "to_be_ordered",
      "pending_receive",
      "partially_received",
      "complete",
    ]);
  });

  it("exposes four ICLOW status tab labels", () => {
    expect(PO_ICLOW_STATUS_TABS.map((t) => t.label)).toEqual([
      "รอสั่งซื้อ",
      "ค้างรับ",
      "รับบางส่วน",
      "รับแล้ว",
    ]);
    expect(PO_ICLOW_STATUS_TABS.map((t) => t.value)).toEqual([
      ...PO_PENDING_RECEIVE_STATUSES,
    ]);
  });
});
