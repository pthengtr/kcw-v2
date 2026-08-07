import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BI_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { fetchCashflowDashboard } from "@/lib/bi/cashflow-dashboard-queries";
import { createAdminClient } from "@/lib/supabase/admin";

const QuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  through_month: z.coerce.number().int().min(1).max(12).optional(),
});

export async function GET(req: Request) {
  const permCheck = await requirePermission(BI_PAGE_KEYS.cashflow);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    year: url.searchParams.get("year") ?? undefined,
    through_month: url.searchParams.get("through_month") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const dashboard = await fetchCashflowDashboard(supabase, {
      year: parsed.data.year,
      throughMonth: parsed.data.through_month ?? null,
    });
    return NextResponse.json({ dashboard });
  } catch (error) {
    console.error("bi cashflow dashboard", error);
    return NextResponse.json(
      { error: "Unable to load cashflow dashboard" },
      { status: 500 }
    );
  }
}
