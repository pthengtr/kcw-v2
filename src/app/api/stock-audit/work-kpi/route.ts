import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { STOCK_AUDIT_PAGE_KEY } from "@/lib/auth/rbac-pages";
import { fetchStockWorkKpi } from "@/lib/stock-audit/work-queries";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 30;

const QuerySchema = z.object({
  branch: z.enum(["HQ", "SYP"]).optional(),
});

export async function GET(req: Request) {
  const permCheck = await requirePermission(STOCK_AUDIT_PAGE_KEY);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    branch: url.searchParams.get("branch") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const kpi = await fetchStockWorkKpi(supabase, {
      branch: parsed.data.branch ?? "HQ",
    });
    return NextResponse.json({ kpi });
  } catch (error) {
    console.error("stock work kpi", error);
    return NextResponse.json(
      { error: "โหลด KPI งานตรวจนับไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
