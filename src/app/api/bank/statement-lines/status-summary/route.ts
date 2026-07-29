import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { BANK_MATCH_STATUSES } from "@/lib/bank/match-status";

const QuerySchema = z.object({
  account_no: z.string().trim().optional(),
  direction: z.string().trim().optional(),
  from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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

  const supabase = createAdminClient();

  const base = supabase
    .schema("bank")
    .from("statement_lines");

  const filteredTotalQuery = base
    .select("id", { count: "exact", head: true });

  let totalQuery = filteredTotalQuery;
  if (account_no) totalQuery = totalQuery.eq("account_no", account_no);
  if (direction) totalQuery = totalQuery.eq("direction", direction);
  if (from) totalQuery = totalQuery.gte("txn_date", from);
  if (to) totalQuery = totalQuery.lte("txn_date", to);

  const [totalRes, counts] = await Promise.all([
    totalQuery,
    Promise.all(
      BANK_MATCH_STATUSES.map(async (status) => {
        let q = base
          .select("id", { count: "exact", head: true })
          .eq("match_status", status);
        if (account_no) q = q.eq("account_no", account_no);
        if (direction) q = q.eq("direction", direction);
        if (from) q = q.gte("txn_date", from);
        if (to) q = q.lte("txn_date", to);

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
  });
}

