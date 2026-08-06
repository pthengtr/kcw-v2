import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BI_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { fetchCashflowOverview } from "@/lib/bi/cashflow-queries";
import { createAdminClient } from "@/lib/supabase/admin";

const QuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  account: z.string().min(1).max(64).optional(),
  include_ignored: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
  limit: z.coerce.number().int().min(1).max(200).optional(),
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
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    account: url.searchParams.get("account") || undefined,
    include_ignored: url.searchParams.get("include_ignored") || undefined,
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
    const overview = await fetchCashflowOverview(supabase, {
      from: parsed.data.from,
      to: parsed.data.to,
      accountNo: parsed.data.account ?? null,
      includeIgnored: parsed.data.include_ignored ?? true,
      limit: parsed.data.limit ?? 30,
    });
    return NextResponse.json({ overview });
  } catch (error) {
    console.error("bi cashflow overview", error);
    return NextResponse.json(
      { error: "Unable to load cashflow overview" },
      { status: 500 }
    );
  }
}
