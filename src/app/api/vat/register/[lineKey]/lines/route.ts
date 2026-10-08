import { NextResponse } from "next/server";

import { requireVatRegisterRead } from "@/lib/vat/access";
import { findVatRegisterLine } from "@/lib/vat/register-queries";
import { createAdminClient } from "@/lib/supabase/admin";

const LINE_KEY = /^[a-f0-9]{32}$/;

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ lineKey: string }> }
) {
  const permCheck = await requireVatRegisterRead();
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

  const month = new URL(req.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const line = await findVatRegisterLine(supabase, lineKey, month);
    if (!line) {
      return NextResponse.json({ error: "Line not found" }, { status: 404 });
    }
    if (line.source !== "expense" || !line.source_ref) {
      return NextResponse.json({ lines: [] });
    }

    const { data, error } = await supabase
      .from("expense_entry")
      .select("entry_uuid, entry_detail, quantity, unit_price, entry_amount")
      .eq("receipt_uuid", line.source_ref)
      .order("entry_amount", { ascending: false });
    if (error) throw error;

    return NextResponse.json({
      lines: (data ?? []).map((row) => ({
        id: String(row.entry_uuid),
        detail: row.entry_detail ? String(row.entry_detail) : null,
        quantity: num(row.quantity),
        price: num(row.unit_price),
        amount: num(row.entry_amount),
      })),
    });
  } catch (error) {
    console.error("vat register lines", error);
    return NextResponse.json({ error: "โหลดรายการไม่สำเร็จ" }, { status: 500 });
  }
}
