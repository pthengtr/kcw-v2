import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BI_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { fetchExpenseOverview } from "@/lib/bi/expense-queries";
import { createAdminClient } from "@/lib/supabase/admin";

const QuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  branch: z.string().uuid().optional(),
  source: z.enum(["ENTRIES", "GENERAL"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(req: Request) {
  const permCheck = await requirePermission(BI_PAGE_KEYS.expenses);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    branch: url.searchParams.get("branch") || undefined,
    source: url.searchParams.get("source") || undefined,
    limit: url.searchParams.get("limit") || undefined,
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
    const overview = await fetchExpenseOverview(supabase, {
      from: parsed.data.from,
      to: parsed.data.to,
      branch: parsed.data.branch ?? null,
      source: parsed.data.source ?? null,
      limit: parsed.data.limit ?? 30,
    });
    return NextResponse.json({ overview });
  } catch (error) {
    console.error("bi expense overview", error);
    return NextResponse.json(
      { error: "Unable to load expense overview" },
      { status: 500 }
    );
  }
}
