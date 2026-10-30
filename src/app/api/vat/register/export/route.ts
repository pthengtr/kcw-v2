import { NextResponse } from "next/server";
import { z } from "zod";

import { requireVatRegisterRead } from "@/lib/vat/access";
import { buildVatRegisterDownload } from "@/lib/vat/register-workbook";
import { fetchVatRegister } from "@/lib/vat/register-queries";
import { monthStartIso } from "@/lib/vat/register";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const QuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  branch: z.enum(["HQ", "SYP"]).optional(),
  side: z.enum(["sales", "purchase"]).optional(),
});

export async function GET(req: Request) {
  const permCheck = await requireVatRegisterRead();
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.message }, { status: permCheck.status });
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
    const download = await buildVatRegisterDownload(rows, {
      month: parsed.data.month,
      branch: parsed.data.branch ?? "ALL",
      side: parsed.data.side ?? "ALL",
    });
    if (!download) {
      return NextResponse.json({ error: "ไม่มีรายการในเดือนนี้" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(download.body), {
      headers: {
        "Content-Type": download.contentType,
        "Content-Disposition": `attachment; filename="${download.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("vat register export", error);
    return NextResponse.json({ error: "ดาวน์โหลดไม่สำเร็จ" }, { status: 500 });
  }
}
