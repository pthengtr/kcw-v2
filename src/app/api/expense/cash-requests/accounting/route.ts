import { NextResponse } from "next/server";
import { z } from "zod";

import { requireExpenseCashAdmin } from "@/lib/expense/cash-request-api";

const BodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  accounting_status: z.enum(["pending", "recorded"]),
  branch: z.enum(["HQ", "SYP"]).optional(),
});

export async function POST(req: Request) {
  const auth = await requireExpenseCashAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { ids, accounting_status, branch } = parsed.data;
  const uniqueIds = [...new Set(ids)];

  const { data: existing, error: loadError } = await auth.supabase
    .from("expense_cash_request")
    .select("id,status")
    .in("id", uniqueIds);

  if (loadError) {
    console.error("expense cash accounting load", loadError);
    return NextResponse.json(
      { error: "Unable to load requests" },
      { status: 500 }
    );
  }

  const rows = existing ?? [];
  if (rows.length !== uniqueIds.length) {
    return NextResponse.json(
      { error: "บางรายการไม่พบหรือไม่มีสิทธิ์" },
      { status: 404 }
    );
  }

  const notPaid = rows.filter((r) => r.status !== "paid");
  if (notPaid.length > 0) {
    return NextResponse.json(
      {
        error:
          "อัปเดตสถานะบัญชีได้เฉพาะรายการที่ถอนเงินแล้ว (status=paid)",
        invalid_ids: notPaid.map((r) => r.id),
      },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    accounting_status,
    accounting_by: auth.userId,
    accounting_by_name: auth.userEmail,
    accounting_at: now,
  };
  if (branch) patch.branch = branch;

  const { data: updated, error: updateError } = await auth.supabase
    .from("expense_cash_request")
    .update(patch)
    .in("id", uniqueIds)
    .eq("status", "paid")
    .select("*");

  if (updateError) {
    console.error("expense cash accounting update", updateError);
    return NextResponse.json(
      { error: "Unable to update accounting status" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    requests: updated ?? [],
    updated: (updated ?? []).length,
  });
}
