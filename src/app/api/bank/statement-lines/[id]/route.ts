import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import {
  BANK_MATCH_STATUSES,
  canOperatorEditMatchFields,
  canOperatorTransitionMatchStatus,
  operatorMatchBy,
} from "@/lib/bank/match-status";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const permCheck = await requirePermission(BANK_PAGE_KEYS.statementSync);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .schema("bank")
    .from("statement_lines")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Query failed", details: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ row: data });
}

const PatchBodySchema = z
  .object({
    match_status: z.enum(BANK_MATCH_STATUSES).optional(),
    match_reason: z.string().trim().max(500).nullable().optional(),
    match_notes: z.string().trim().max(4000).nullable().optional(),
    matched_ref_type: z.string().trim().max(100).nullable().optional(),
    matched_ref_id: z.string().trim().max(200).nullable().optional(),
  })
  .refine(
    (body) =>
      body.match_status !== undefined ||
      body.match_reason !== undefined ||
      body.match_notes !== undefined ||
      body.matched_ref_type !== undefined ||
      body.matched_ref_id !== undefined,
    { message: "No match fields to update" }
  );

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const permCheck = await requirePermission(BANK_PAGE_KEYS.statementSync);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const parsed = PatchBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: existing, error: existingError } = await supabase
    .schema("bank")
    .from("statement_lines")
    .select(
      "id, match_status, match_reason, match_notes, matched_ref_type, matched_ref_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: "Query failed", details: existingError.message },
      { status: 500 }
    );
  }
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const currentStatus = String(existing.match_status ?? "");
  if (!canOperatorEditMatchFields(currentStatus)) {
    return NextResponse.json(
      { error: `สถานะ ${currentStatus} แก้ไม่ได้` },
      { status: 400 }
    );
  }

  const nextStatus = parsed.data.match_status ?? currentStatus;
  if (!canOperatorTransitionMatchStatus(currentStatus, nextStatus)) {
    return NextResponse.json(
      {
        error: `เปลี่ยนสถานะจาก ${currentStatus} เป็น ${nextStatus} ไม่ได้`,
      },
      { status: 400 }
    );
  }

  const patch: Record<string, unknown> = {
    match_status: nextStatus,
    matched_at: new Date().toISOString(),
    matched_by: operatorMatchBy(permCheck.userEmail),
  };

  if (parsed.data.match_reason !== undefined) {
    patch.match_reason = parsed.data.match_reason;
  }
  if (parsed.data.match_notes !== undefined) {
    patch.match_notes = parsed.data.match_notes;
  }
  if (parsed.data.matched_ref_type !== undefined) {
    patch.matched_ref_type = parsed.data.matched_ref_type;
  }
  if (parsed.data.matched_ref_id !== undefined) {
    patch.matched_ref_id = parsed.data.matched_ref_id;
  }

  // Require a short reason when closing review/unmatched queues.
  if (
    (nextStatus === "resolved" || nextStatus === "manual") &&
    !(
      (typeof patch.match_reason === "string" && patch.match_reason.trim()) ||
      (typeof existing.match_reason === "string" &&
        existing.match_reason.trim())
    )
  ) {
    return NextResponse.json(
      { error: "กรุณาระบุเหตุผลก่อนบันทึกเป็นตรวจแล้ว/จับคู่ด้วยมือ" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .schema("bank")
    .from("statement_lines")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Update failed", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, row: data });
}
