import { NextResponse } from "next/server";
import { z } from "zod";

import { requireVatRegisterWrite } from "@/lib/vat/access";
import {
  findVatDocMonthSyncTargets,
  findVatRegisterLine,
  normalizeVatDocMonth,
} from "@/lib/vat/register-queries";
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
  reportMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Document month for accounting. Accepts YYYY-MM or YYYY-MM-DD; stored as YYYY-MM-01. */
  docMonth: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/).nullable().optional(),
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

  const docMonth = normalizeVatDocMonth(parsed.data.docMonth ?? null);

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

    const targets = await findVatDocMonthSyncTargets(
      supabase,
      line,
      parsed.data.reportMonth
    );
    const now = new Date().toISOString();
    for (const target of targets) {
      const { error } = await supabase.schema("ops").from("vat_line_evidence").upsert(
        {
          line_key: target.line_key,
          branch: target.branch,
          side: target.side,
          doc_type: target.sheet,
          bill_no: target.bill_no,
          bill_date: target.bill_date,
          doc_month: docMonth,
          updated_by: permCheck.userId,
          updated_at: now,
        },
        { onConflict: "line_key" }
      );
      if (error) throw error;
    }

    return NextResponse.json({
      ok: true,
      docMonth,
      lineKeys: targets.map((target) => target.line_key),
    });
  } catch (error) {
    console.error("vat register doc-month", error);
    return NextResponse.json(
      { error: "Unable to save document month" },
      { status: 500 }
    );
  }
}
