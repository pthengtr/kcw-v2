import { NextResponse } from "next/server";
import { z } from "zod";

import { requireVatRegisterRead } from "@/lib/vat/access";
import { fetchVatRegister } from "@/lib/vat/register-queries";
import { monthStartIso } from "@/lib/vat/register";
import { createAdminClient } from "@/lib/supabase/admin";

const QuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  branch: z.enum(["HQ", "SYP"]).optional(),
  side: z.enum(["sales", "purchase"]).optional(),
});

export async function GET(req: Request) {
  const permCheck = await requireVatRegisterRead();
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    month: url.searchParams.get("month") ?? undefined,
    branch: url.searchParams.get("branch") || undefined,
    side: url.searchParams.get("side") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const rows = await fetchVatRegister(supabase, {
      monthStart: monthStartIso(parsed.data.month),
      branch: parsed.data.branch ?? null,
      side: parsed.data.side ?? null,
    });
    return NextResponse.json({ rows });
  } catch (error) {
    console.error("vat register", error);
    return NextResponse.json(
      { error: "Unable to load VAT register" },
      { status: 500 }
    );
  }
}
