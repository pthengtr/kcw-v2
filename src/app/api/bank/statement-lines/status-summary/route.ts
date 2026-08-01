import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { BANK_MATCH_STATUSES } from "@/lib/bank/match-status";

const QuerySchema = z.object({
  account_no: z.string().trim().min(1),
  direction: z.string().trim().optional(),
  from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: Request) {
  const permCheck = await requirePermission(BANK_PAGE_KEYS.statementSync);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { account_no, direction, from, to } = parsed.data;
  if (from > to) {
    return NextResponse.json(
      { error: "`from` must be on or before `to`" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const base = supabase.schema("bank").from("statement_lines");

  let totalQuery = base
    .select("id", { count: "exact", head: true })
    .eq("account_no", account_no)
    .gte("txn_date", from)
    .lte("txn_date", to);
  if (direction) totalQuery = totalQuery.eq("direction", direction);

  const [totalRes, counts] = await Promise.all([
    totalQuery,
    Promise.all(
      BANK_MATCH_STATUSES.map(async (status) => {
        let q = base
          .select("id", { count: "exact", head: true })
          .eq("account_no", account_no)
          .eq("match_status", status)
          .gte("txn_date", from)
          .lte("txn_date", to);
        if (direction) q = q.eq("direction", direction);

        const { count, error } = await q;
        if (error) throw error;
        return { status, count: count ?? 0 };
      })
    ),
  ]);

  if (totalRes.error) {
    return NextResponse.json(
      { error: "Query failed", details: totalRes.error.message },
      { status: 500 }
    );
  }

  const countsByStatus: Record<string, number> = {};
  for (const c of counts) countsByStatus[c.status] = c.count;

  return NextResponse.json({
    total: totalRes.count ?? 0,
    counts: countsByStatus,
    account_no,
    from,
    to,
  });
}
