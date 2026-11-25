import { describe, expect, it } from "vitest";

import {
  TICKET_LIST_FILTERS,
  TICKET_PAGE_SIZE,
  filterSupportTickets,
  matchesTicketListFilter,
} from "./list-filters";
import type { SupportTicketStatus } from "./types";

describe("TICKET_LIST_FILTERS", () => {
  it("omits ยังไม่ปิด so it does not overlap รอตรวจ", () => {
    expect(TICKET_LIST_FILTERS.map((f) => f.value)).toEqual([
      "running",
      "waiting",
      "done",
      "all",
    ]);
    expect(TICKET_LIST_FILTERS.map((f) => f.label)).toEqual([
      "กำลังทำ",
      "รอตรวจ",
      "ปิดแล้ว",
      "ทั้งหมด",
    ]);
  });
});

describe("matchesTicketListFilter", () => {
  const statuses: SupportTicketStatus[] = [
    "pending",
    "running",
    "waiting",
    "done",
    "failed",
  ];

  it("defaults open to every non-done status", () => {
    expect(statuses.filter((s) => matchesTicketListFilter(s, "open"))).toEqual([
      "pending",
      "running",
      "waiting",
      "failed",
    ]);
  });

  it("maps กำลังทำ to pending + running", () => {
    expect(
      statuses.filter((s) => matchesTicketListFilter(s, "running"))
    ).toEqual(["pending", "running"]);
  });

  it("maps รอตรวจ / ปิดแล้ว / ทั้งหมด", () => {
    expect(matchesTicketListFilter("waiting", "waiting")).toBe(true);
    expect(matchesTicketListFilter("done", "done")).toBe(true);
    expect(statuses.every((s) => matchesTicketListFilter(s, "all"))).toBe(true);
  });
});

describe("filterSupportTickets", () => {
  const tickets = [
    {
      id: "1",
      status: "done" as const,
      title: "ปิดแล้ว A",
      created_at: "2026-01-01T10:00:00Z",
    },
    {
      id: "2",
      status: "waiting" as const,
      title: "รอตรวจ B",
      created_at: "2026-01-03T10:00:00Z",
    },
    {
      id: "3",
      status: "running" as const,
      title: "กำลังทำ C",
      created_at: "2026-01-02T10:00:00Z",
    },
    {
      id: "4",
      status: "pending" as const,
      title: "หัวข้อพิเศษ D",
      created_at: "2026-01-04T10:00:00Z",
    },
  ];

  it("filters by title and sorts newest first", () => {
    const result = filterSupportTickets(tickets, "all", "พิเศษ");
    expect(result.map((t) => t.id)).toEqual(["4"]);
  });

  it("keeps open tickets newest-first for the default filter", () => {
    const result = filterSupportTickets(tickets, "open", "");
    expect(result.map((t) => t.id)).toEqual(["4", "2", "3"]);
  });

  it("exposes page size of 10", () => {
    expect(TICKET_PAGE_SIZE).toBe(10);
  });
});
