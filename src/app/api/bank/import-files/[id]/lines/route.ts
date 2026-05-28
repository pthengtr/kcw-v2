import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return NextResponse.json(
      { error: adminCheck.message },
      { status: adminCheck.status }
    );
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { limit } = parsed.data;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .schema("bank")
    .from("statement_lines")
    .select(
      [
        "id",
        "txn_date",
        "description",
        "amount",
        "direction",
        "balance_after",
        "bank_reference",
        "account_no",
        "bank_name",
        "match_status",
        "source_sheet_name",
        "source_row_number",
        "source_file_id",
      ].join(",")
    )
    .eq("source_file_id", id)
    .order("source_row_number", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) {
    return NextResponse.json(
      { error: "Query failed", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ rows: data ?? [] });
}

