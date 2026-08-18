import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BI_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { fetchProductSales } from "@/lib/bi/product-sales-queries";
import { createAdminClient } from "@/lib/supabase/admin";

const QuerySchema = z.object({
  bcode: z.string().trim().min(1).max(32),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  branch: z.enum(["HQ", "SYP", "ONLINE"]).optional(),
  history_limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(req: Request) {
  const permCheck = await requirePermission(BI_PAGE_KEYS.productSales);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    bcode: url.searchParams.get("bcode") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    branch: url.searchParams.get("branch") || undefined,
    history_limit: url.searchParams.get("history_limit") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  if (parsed.data.from > parsed.data.to) {
    return NextResponse.json(
      { error: "from must be on or before to" },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();
    const overview = await fetchProductSales(supabase, {
      bcode: parsed.data.bcode,
      from: parsed.data.from,
      to: parsed.data.to,
      branch: parsed.data.branch ?? null,
      historyLimit: parsed.data.history_limit ?? 40,
    });
    return NextResponse.json({ overview });
  } catch (error) {
    console.error("bi product sales", error);
    return NextResponse.json(
      { error: "Unable to load product sales" },
      { status: 500 }
    );
  }
}
