import { NextResponse } from "next/server";
import { z } from "zod";

import { requireVatRegisterWrite } from "@/lib/vat/access";
import { findVatRegisterLine } from "@/lib/vat/register-queries";
import { vatLineKey } from "@/lib/vat/register";
import { createAdminClient } from "@/lib/supabase/admin";

const LINE_KEY = /^[a-f0-9]{32}$/;

const AmountSchema = z.number().finite().min(0).max(1_000_000_000);

const BodySchema = z.object({
  branch: z.enum(["HQ", "SYP"]),
  side: z.literal("purchase"),
  sheet: z.string().min(1).max(80),
  billNo: z.string().min(1).max(80),
  billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceRef: z.string().uuid().nullable().optional(),
  reportMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Null clears the override and restores book amounts. */
  beforeVat: AmountSchema.nullable(),
  vat: AmountSchema.nullable(),
  afterVat: AmountSchema.nullable(),
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

  const { beforeVat, vat, afterVat } = parsed.data;
  const clearing = beforeVat == null && vat == null && afterVat == null;
  const setting = beforeVat != null && vat != null && afterVat != null;
  if (!clearing && !setting) {
    return NextResponse.json(
      { error: "Provide all three amounts, or null to clear" },
      { status: 400 }
    );
  }
  if (setting && Math.abs((beforeVat as number) + (vat as number) - (afterVat as number)) > 0.05) {
    return NextResponse.json(
      { error: "After-VAT must equal before-VAT + VAT" },
      { status: 400 }
    );
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
    const line = await findVatRegisterLine(
      supabase,
      lineKey,
      parsed.data.reportMonth
    );
    if (!line) {
      return NextResponse.json({ error: "Line not found" }, { status: 404 });
    }
    if (line.side !== "purchase") {
      return NextResponse.json(
        { error: "Amount override is only for purchase lines" },
        { status: 400 }
      );
    }

    const { error } = await supabase.schema("ops").from("vat_line_evidence").upsert(
      {
        line_key: lineKey,
        branch: line.branch,
        side: line.side,
        doc_type: line.sheet,
        bill_no: line.bill_no,
        bill_date: line.bill_date,
        override_before_vat: clearing ? null : beforeVat,
        override_vat: clearing ? null : vat,
        override_after_vat: clearing ? null : afterVat,
        updated_by: permCheck.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "line_key" }
    );
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      beforeVat: clearing ? null : beforeVat,
      vat: clearing ? null : vat,
      afterVat: clearing ? null : afterVat,
      amountOverridden: !clearing,
    });
  } catch (error) {
    console.error("vat register amounts", error);
    return NextResponse.json(
      { error: "Unable to save purchase amounts" },
      { status: 500 }
    );
  }
}
