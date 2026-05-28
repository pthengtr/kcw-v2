import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const QuerySchema = z.object({
  status: z.string().trim().optional(),
  bank_name: z.string().trim().optional(),
  account_no: z.string().trim().optional(),
  from: z.string().trim().optional(), // ISO date or timestamptz
  to: z.string().trim().optional(), // ISO date or timestamptz
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(200_000).default(0),
});

export async function GET(req: Request) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.ok) {
      return NextResponse.json(
        { error: adminCheck.message },
        { status: adminCheck.status }
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

    const { status, bank_name, account_no, from, to, limit, offset } =
      parsed.data;

    const supabase = createAdminClient();

    let query = supabase
      .schema("bank")
      .from("statement_import_files")
      .select(
        [
          "id",
          "last_seen_at",
          "bank_name",
          "account_no",
          "original_filename",
          "status",
          "row_count",
          "inserted_count",
          "duplicate_count",
          "error_count",
          "error_message",
          "raw_metadata",
        ].join(","),
        { count: "exact" }
      )
      .order("last_seen_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);
    if (bank_name) query = query.ilike("bank_name", `%${bank_name}%`);
    if (account_no) query = query.ilike("account_no", `%${account_no}%`);
    if (from) query = query.gte("last_seen_at", from);
    if (to) query = query.lte("last_seen_at", to);

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
      limit,
      offset,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: "Internal server error",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}

