import type { SupabaseClient } from "@supabase/supabase-js";

import { STOCK_AUDIT_DAILY_TARGET } from "@/lib/stock-audit/daily-target";
import { fetchStockWorkKpi } from "@/lib/stock-audit/work-queries";
import { getLatestCashSnapshot } from "@/lib/bank/tiger-pay-queries";
import type { TigerPayCashSnapshot } from "@/lib/bank/tiger-pay-daily";

export { STOCK_AUDIT_DAILY_TARGET };

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

function hopperTodo(snapshot: TigerPayCashSnapshot | null): WorkspaceTodoItem {
  if (!snapshot) {
    return {
      id: "tiger-pay-hopper",
      title: "เติมเงินทอนเครื่อง Tiger",
      description: "สถานะเงินทอนในเครื่องรับชำระ HQ",
      href: "/tiger-pay",
      status: "unknown",
      primaryValue: "ยังไม่มี snapshot",
      secondaryValue: "รอ kcw-api อ่านเครื่อง",
    };
  }

  const status: WorkspaceTodoStatus =
    snapshot.change_ready === false || snapshot.change_level === "red"
      ? "urgent"
      : snapshot.change_level === "orange"
        ? "attention"
        : "ok";

  const primaryValue =
    status === "urgent"
      ? "ต้องเติมด่วน"
      : status === "attention"
        ? "เริ่มน้อย"
        : "พร้อมทอน";

  return {
    id: "tiger-pay-hopper",
    title: "เติมเงินทอนเครื่อง Tiger",
    description: "สถานะเงินทอนในเครื่องรับชำระ HQ",
    href: "/tiger-pay",
    status,
    primaryValue,
    secondaryValue:
      snapshot.change_reasons.slice(0, 3).join(" · ") ||
      (snapshot.change_ready === false ? "เครื่องทอนไม่ได้" : undefined),
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
  adminClient: SupabaseClient;
}): Promise<WorkspaceTodoItem[]> {
  const [stockResult, hopperResult] = await Promise.allSettled([
    (async () => {
      const kpi = await fetchStockWorkKpi(params.adminClient, {
        branch: "HQ",
      });
      return stockAuditTodo(kpi.summary_today.completed_counts);
    })(),
    (async () => {
      const snapshot = await getLatestCashSnapshot(params.adminClient, "1");
      return hopperTodo(snapshot);
    })(),
  ]);

  return [
    stockResult.status === "fulfilled"
      ? stockResult.value
      : unknownTodo(
          "stock-audit-daily",
          "เป้าหมายตรวจนับรายวัน",
          "/stock-audit",
          `เป้าสาขา ${STOCK_AUDIT_DAILY_TARGET} รายการ/วัน (HQ · นับผ่าน LINE)`
        ),
    hopperResult.status === "fulfilled"
      ? hopperResult.value
      : unknownTodo(
          "tiger-pay-hopper",
          "เติมเงินทอนเครื่อง Tiger",
          "/tiger-pay",
          "สถานะเงินทอนในเครื่องรับชำระ HQ"
        ),
  ];
}
