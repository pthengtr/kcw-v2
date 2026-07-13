import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTigerPaySummary } from "@/lib/bank/tiger-pay-queries";

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
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const summary = await getTigerPaySummary(supabase, {
      search: parsed.data.search,
      paymentType: parsed.data.payment_type,
      statusGroup: parsed.data.status_group,
      from: parsed.data.from,
      to: parsed.data.to,
    });

    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json(
      { error: "Unable to load Tiger Pay summary" },
      { status: 500 }
    );
  }
}
