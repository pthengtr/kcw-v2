import type { SupabaseClient } from "@supabase/supabase-js";

import { listPoHeaders } from "@/lib/po/po-queries";
import { fetchStockAuditOverview } from "@/lib/stock-audit/queries";

/** Soft daily target — same as stock-audit operator page. */
export const STOCK_AUDIT_DAILY_TARGET = 30;

export type WorkspaceTodoStatus = "ok" | "attention" | "urgent" | "unknown";

export type WorkspaceTodoItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  status: WorkspaceTodoStatus;
  primaryValue: string;
  secondaryValue?: string;
};

export function bangkokTodayIsoDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

async function countPaymentReminders(
  supabase: SupabaseClient,
  opts: {
    unpaidOnly?: boolean;
    dueOn?: string;
    dueBefore?: string;
  }
): Promise<number> {
  let query = supabase
    .from("payment_reminder")
    .select("reminder_uuid", { count: "exact", head: true });

  if (opts.unpaidOnly) {
    query = query.is("payment_date", null);
  }
  if (opts.dueOn) {
    const next = addDaysIso(opts.dueOn, 1);
    query = query
      .gte("due_date", `${opts.dueOn}T00:00:00`)
      .lt("due_date", `${next}T00:00:00`);
  }
  if (opts.dueBefore) {
    query = query.lt("due_date", `${opts.dueBefore}T00:00:00`);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

function reminderTodo(params: {
  unpaidTotal: number;
  unpaidDueToday: number;
  unpaidOverdue: number;
}): WorkspaceTodoItem {
  const { unpaidTotal, unpaidDueToday, unpaidOverdue } = params;
  const status: WorkspaceTodoStatus =
    unpaidOverdue > 0
      ? "urgent"
      : unpaidDueToday > 0 || unpaidTotal > 0
        ? "attention"
        : "ok";

  const parts: string[] = [];
  if (unpaidOverdue > 0) parts.push(`เกินกำหนด ${unpaidOverdue}`);
  if (unpaidDueToday > 0) parts.push(`ครบกำหนดวันนี้ ${unpaidDueToday}`);
  if (unpaidTotal === 0) parts.push("ไม่มีรายการค้างชำระ");
  else if (unpaidOverdue === 0 && unpaidDueToday === 0) {
    parts.push(`ค้างชำระทั้งหมด ${unpaidTotal}`);
  }

  return {
    id: "payment-reminder",
    title: "เตือนโอน",
    description: "รายการที่ยังไม่ได้บันทึกวันชำระ",
    href: "/reminder",
    status,
    primaryValue:
      unpaidTotal === 0 ? "เรียบร้อย" : `${unpaidTotal.toLocaleString("th-TH")} รายการ`,
    secondaryValue: parts.join(" · "),
  };
}

function sypPoTodo(notPreparedToday: number): WorkspaceTodoItem {
  const status: WorkspaceTodoStatus =
    notPreparedToday > 0 ? "attention" : "ok";

  return {
    id: "syp-po-not-prepared",
    title: "SYP PO ยังไม่จัด",
    description: "ใบสั่งซื้อวันที่วันนี้ที่ยังไม่จัดของ",
    href: "/po",
    status,
    primaryValue:
      notPreparedToday === 0
        ? "เรียบร้อย"
        : `${notPreparedToday.toLocaleString("th-TH")} ใบ`,
    secondaryValue:
      notPreparedToday === 0
        ? "PO วันนี้จัดครบแล้ว"
        : "ต้องจัดของให้ครบในวันนี้",
  };
}

function stockAuditTodo(markedToday: number): WorkspaceTodoItem {
  const remaining = Math.max(0, STOCK_AUDIT_DAILY_TARGET - markedToday);
  const status: WorkspaceTodoStatus =
    markedToday >= STOCK_AUDIT_DAILY_TARGET ? "ok" : "attention";

  return {
    id: "stock-audit-daily",
    title: "เป้าหมายตรวจนับรายวัน",
    description: `เป้าสาขา ${STOCK_AUDIT_DAILY_TARGET} รายการ/วัน (HQ · นับผ่าน LINE)`,
    href: "/stock-audit",
    status,
    primaryValue: `${markedToday.toLocaleString("th-TH")}/${STOCK_AUDIT_DAILY_TARGET}`,
    secondaryValue:
      remaining === 0
        ? "ถึงเป้าหมายวันนี้แล้ว"
        : `เหลืออีก ${remaining.toLocaleString("th-TH")} รายการ`,
  };
}

function unknownTodo(
  id: string,
  title: string,
  href: string,
  description: string
): WorkspaceTodoItem {
  return {
    id,
    title,
    description,
    href,
    status: "unknown",
    primaryValue: "—",
    secondaryValue: "โหลดสถานะไม่สำเร็จ",
  };
}

export async function fetchWorkspaceTodos(params: {
  userClient: SupabaseClient;
  adminClient: SupabaseClient;
  today?: string;
}): Promise<WorkspaceTodoItem[]> {
  const today = params.today ?? bangkokTodayIsoDate();

  const [reminderResult, poResult, stockResult] = await Promise.allSettled([
    (async () => {
      const [unpaidTotal, unpaidDueToday, unpaidOverdue] = await Promise.all([
        countPaymentReminders(params.userClient, { unpaidOnly: true }),
        countPaymentReminders(params.userClient, {
          unpaidOnly: true,
          dueOn: today,
        }),
        countPaymentReminders(params.userClient, {
          unpaidOnly: true,
          dueBefore: today,
        }),
      ]);
      return reminderTodo({ unpaidTotal, unpaidDueToday, unpaidOverdue });
    })(),
    (async () => {
      const { count } = await listPoHeaders({
        supabase: params.adminClient,
        site: "SYP",
        status: "open",
        prepareFilter: "not_prepared",
        from: today,
        to: today,
        months: 1,
        limit: 1,
        offset: 0,
      });
      return sypPoTodo(count ?? 0);
    })(),
    (async () => {
      const overview = await fetchStockAuditOverview(params.adminClient, {
        branch: "HQ",
        withStockOnly: true,
        limit: 1,
        offset: 0,
      });
      return stockAuditTodo(overview.summary.marked_today_count);
    })(),
  ]);

  return [
    reminderResult.status === "fulfilled"
      ? reminderResult.value
      : unknownTodo(
          "payment-reminder",
          "เตือนโอน",
          "/reminder",
          "รายการที่ยังไม่ได้บันทึกวันชำระ"
        ),
    poResult.status === "fulfilled"
      ? poResult.value
      : unknownTodo(
          "syp-po-not-prepared",
          "SYP PO ยังไม่จัด",
          "/po",
          "ใบสั่งซื้อวันที่วันนี้ที่ยังไม่จัดของ"
        ),
    stockResult.status === "fulfilled"
      ? stockResult.value
      : unknownTodo(
          "stock-audit-daily",
          "เป้าหมายตรวจนับรายวัน",
          "/stock-audit",
          `เป้าสาขา ${STOCK_AUDIT_DAILY_TARGET} รายการ/วัน (HQ · นับผ่าน LINE)`
        ),
  ];
}
