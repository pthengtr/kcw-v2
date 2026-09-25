import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTigerPayKbankQrMonthSum } from "@/lib/bank/tiger-pay-queries";

const QuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shop: z.string().trim().min(1).max(32).default("1"),
});

export async function GET(req: Request) {
  const permCheck = await requirePermission(BANK_PAGE_KEYS.tigerPay);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    date: url.searchParams.get("date") ?? undefined,
    shop: url.searchParams.get("shop") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const kbankQrMonth = await getTigerPayKbankQrMonthSum(supabase, {
      date: parsed.data.date,
      shopCode: parsed.data.shop,
    });
    return NextResponse.json({ kbankQrMonth });
  } catch (error) {
    console.error("tiger-pay kbank qr month", error);
    return NextResponse.json(
      { error: "Unable to load KBANK QR month total" },
      { status: 500 }
    );
  }
}
