import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTigerPayTransactions } from "@/lib/bank/tiger-pay-queries";

const QuerySchema = z.object({
  search: z.string().trim().optional(),
  payment_type: z
    .enum(["all", "cash", "promptpay", "qr", "other"])
    .default("all"),
  status_group: z
    .enum(["all", "successful", "pending", "cancelled", "other"])
    .default("all"),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  sort_by: z
    .enum([
      "last_received_at",
      "tiger_updated_at",
      "amount",
      "total_pay",
      "payment_no",
      "status",
    ])
    .default("last_received_at"),
  sort_dir: z.enum(["asc", "desc"]).default("desc"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export async function GET(req: Request) {
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
      { error: "Invalid query" },
      { status: 400 }
    );
  }

  const {
    search,
    payment_type,
    status_group,
    from,
    to,
    sort_by,
    sort_dir,
    limit,
    offset,
  } = parsed.data;

  try {
    const supabase = createAdminClient();
    const page = Math.floor(offset / limit) + 1;
    const result = await getTigerPayTransactions(supabase, {
      page,
      pageSize: limit,
      search,
      paymentType: payment_type,
      statusGroup: status_group,
      from,
      to,
      sortBy: sort_by,
      sortDir: sort_dir,
    });

    return NextResponse.json({
      rows: result.rows,
      count: result.count,
      limit,
      offset,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load Tiger Pay transactions" },
      { status: 500 }
    );
  }
}
