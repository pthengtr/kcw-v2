import type { SupportTicketStatus } from "./types";

export type TicketListFilter = "open" | "running" | "waiting" | "done" | "all";

export const TICKET_PAGE_SIZE = 10;

export const TICKET_LIST_FILTERS: { value: TicketListFilter; label: string }[] =
  [
    { value: "open", label: "ยังไม่ปิด" },
    { value: "running", label: "กำลังทำ" },
    { value: "waiting", label: "รอตรวจ" },
    { value: "done", label: "ปิดแล้ว" },
    { value: "all", label: "ทั้งหมด" },
  ];

/** Default list view: anything still in flight (not closed). */
export function matchesTicketListFilter(
  status: SupportTicketStatus,
  filter: TicketListFilter
): boolean {
  switch (filter) {
    case "open":
      return status !== "done";
    case "running":
      // รอคิว + กำลังทำ — งานที่ยังไม่ถึงขั้นรอผู้ใช้ตรวจ
      return status === "running" || status === "pending";
    case "waiting":
      return status === "waiting";
    case "done":
      return status === "done";
    case "all":
      return true;
  }
}

export function filterSupportTickets<
  T extends { status: SupportTicketStatus; title: string; created_at: string },
>(tickets: T[], filter: TicketListFilter, titleQuery: string): T[] {
  const q = titleQuery.trim().toLowerCase();
  return tickets
    .filter((t) => matchesTicketListFilter(t.status, filter))
    .filter((t) => (q ? t.title.toLowerCase().includes(q) : true))
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}
