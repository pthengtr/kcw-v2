import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BI_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { fetchCashflowDrilldown } from "@/lib/bi/cashflow-dashboard-queries";
import { createAdminClient } from "@/lib/supabase/admin";

const QuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  code: z.string().regex(/^(100[1-4]|200[12]|300[12])$/),
  limit: z.coerce.number().int().min(1).max(500).optional(),
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
    month: url.searchParams.get("month") ?? undefined,
    code: url.searchParams.get("code") ?? undefined,
    limit: url.searchParams.get("limit") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const drilldown = await fetchCashflowDrilldown(supabase, {
      year: parsed.data.year,
      month: parsed.data.month,
      code: parsed.data.code,
      limit: parsed.data.limit ?? 200,
    });
    return NextResponse.json({ drilldown });
  } catch (error) {
    console.error("bi cashflow drilldown", error);
    return NextResponse.json(
      { error: "Unable to load cashflow drilldown" },
      { status: 500 }
    );
  }
}
