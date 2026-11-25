import { NextResponse } from "next/server";
import { z } from "zod";

import { requireExpenseCashViewer } from "@/lib/expense/cash-request-api";

const BodySchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(200),
    accounting_status: z.enum(["pending", "recorded", "skipped"]),
    branch: z.enum(["HQ", "SYP"]).optional(),
    accounting_skip_reason: z
      .enum(["system_test", "refunded", "other"])
      .optional(),
    accounting_skip_note: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.accounting_status !== "skipped") return;
    if (!data.accounting_skip_reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ต้องเลือกเหตุผลเมื่อไม่ลงค่าใช้จ่าย",
        path: ["accounting_skip_reason"],
      });
      return;
    }
    if (data.accounting_skip_reason === "other") {
      const note = (data.accounting_skip_note ?? "").trim();
      if (!note) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "กรุณาระบุเหตุผลเมื่อเลือกอื่น ๆ",
          path: ["accounting_skip_note"],
        });
      }
    }
  });

export async function POST(req: Request) {
  // Accounting mark is open to any signed-in staff; approve/reject stays admin-only.
  // RLS only allows admin UPDATE — use service role after auth.
  const auth = await requireExpenseCashViewer();
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
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: firstIssue?.message || "Invalid body",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const {
    ids,
    accounting_status,
    branch,
    accounting_skip_reason,
    accounting_skip_note,
  } = parsed.data;
  const uniqueIds = [...new Set(ids)];

  const { data: existing, error: loadError } = await auth.admin
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

  if (accounting_status === "skipped") {
    patch.accounting_skip_reason = accounting_skip_reason;
    patch.accounting_skip_note =
      accounting_skip_reason === "other"
        ? (accounting_skip_note ?? "").trim()
        : (accounting_skip_note ?? "").trim() || null;
  } else {
    patch.accounting_skip_reason = null;
    patch.accounting_skip_note = null;
  }

  const { data: updated, error: updateError } = await auth.admin
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
