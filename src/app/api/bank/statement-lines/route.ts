import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";

const QuerySchema = z.object({
  account_no: z.string().trim().min(1),
  bank_name: z.string().trim().optional(),
  direction: z.string().trim().optional(),
  match_status: z.string().trim().optional(),
  from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount_min: z.coerce.number().optional(),
  amount_max: z.coerce.number().optional(),
  // Higher cap is safe because account_no + month is always required.
  limit: z.coerce.number().int().min(1).max(5000).default(50),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
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

  const {
    account_no,
    bank_name,
    direction,
    match_status,
    from,
    to,
    amount_min,
    amount_max,
    limit,
    offset,
  } = parsed.data;

  if (from > to) {
    return NextResponse.json(
      { error: "`from` must be on or before `to`" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  let query = supabase
    .schema("bank")
    .from("statement_lines")
    .select(
      [
        "id",
        "txn_date",
        "created_at",
        "description",
        "amount",
        "direction",
        "balance_after",
        "bank_reference",
        "account_no",
        "bank_name",
        "match_status",
        "match_reason",
        "match_confidence",
        "matched_ref_type",
        "matched_ref_id",
        "match_notes",
        "report_remark",
        "matched_at",
        "matched_by",
        "source_sheet_name",
        "source_row_number",
        "source_file_id",
      ].join(","),
      { count: "exact" }
    )
    .eq("account_no", account_no)
    .gte("txn_date", from)
    .lte("txn_date", to)
    .order("txn_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (bank_name) query = query.ilike("bank_name", `%${bank_name}%`);
  if (direction) query = query.eq("direction", direction);
  if (match_status) query = query.eq("match_status", match_status);
  if (typeof amount_min === "number") query = query.gte("amount", amount_min);
  if (typeof amount_max === "number") query = query.lte("amount", amount_max);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Query failed", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    rows: data ?? [],
    count: count ?? null,
    account_no,
    from,
    to,
    limit,
    offset,
  });
}
