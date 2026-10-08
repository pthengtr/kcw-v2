import { NextResponse } from "next/server";
import { z } from "zod";

import { requireVatRegisterWrite } from "@/lib/vat/access";
import { findVatRegisterLine } from "@/lib/vat/register-queries";
import { vatLineKey } from "@/lib/vat/register";
import { createAdminClient } from "@/lib/supabase/admin";

const LINE_KEY = /^[a-f0-9]{32}$/;

const BodySchema = z.object({
  branch: z.enum(["HQ", "SYP"]),
  side: z.enum(["sales", "purchase"]),
  sheet: z.string().min(1).max(80),
  billNo: z.string().min(1).max(80),
  billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceRef: z.string().uuid().nullable().optional(),
  paidStatus: z.enum(["unpaid", "paid"]),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ lineKey: string }> }
) {
  const permCheck = await requireVatRegisterWrite();
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const { lineKey } = await context.params;
  if (!LINE_KEY.test(lineKey)) {
    return NextResponse.json({ error: "Invalid line" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const expected = vatLineKey({
    branch: parsed.data.branch,
    side: parsed.data.side,
    sheet: parsed.data.sheet,
    billNo: parsed.data.billNo,
    billDate: parsed.data.billDate,
    sourceRef: parsed.data.sourceRef ?? null,
  });
  if (expected !== lineKey) {
    return NextResponse.json({ error: "Line key mismatch" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const line = await findVatRegisterLine(supabase, lineKey);
    if (!line) {
      return NextResponse.json({ error: "Line not found" }, { status: 404 });
    }

    const { error } = await supabase.schema("ops").from("vat_line_evidence").upsert(
      {
        line_key: lineKey,
        branch: line.branch,
        side: line.side,
        doc_type: line.sheet,
        bill_no: line.bill_no,
        bill_date: line.bill_date,
        paid_status: parsed.data.paidStatus,
        paid_on:
          parsed.data.paidStatus === "paid" ? parsed.data.paidOn ?? null : null,
        note: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
        updated_by: permCheck.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "line_key" }
    );
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("vat register paid", error);
    return NextResponse.json(
      { error: "Unable to save paid status" },
      { status: 500 }
    );
  }
}
