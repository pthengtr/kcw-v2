import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { STOCK_AUDIT_PAGE_KEY } from "@/lib/auth/rbac-pages";
import { skipStockAuditItem } from "@/lib/stock-audit/queries";
import { createAdminClient } from "@/lib/supabase/admin";

const BodySchema = z.object({
  batch_id: z.string().uuid(),
  bcode: z.string().trim().min(1).max(64),
});

export async function POST(req: Request) {
  const permCheck = await requirePermission(STOCK_AUDIT_PAGE_KEY);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const batch = await skipStockAuditItem(supabase, {
      batchId: parsed.data.batch_id,
      bcode: parsed.data.bcode,
      by: permCheck.userEmail,
    });
    return NextResponse.json({ batch });
  } catch (error) {
    console.error("stock audit skip", error);
    return NextResponse.json(
      { error: "ข้ามรายการไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
