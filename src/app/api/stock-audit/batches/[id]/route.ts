import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { STOCK_AUDIT_PAGE_KEY } from "@/lib/auth/rbac-pages";
import { fetchStockAuditBatch } from "@/lib/stock-audit/queries";
import { createAdminClient } from "@/lib/supabase/admin";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const permCheck = await requirePermission(STOCK_AUDIT_PAGE_KEY);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const params = ParamsSchema.safeParse(await ctx.params);
  if (!params.success) {
    return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const batch = await fetchStockAuditBatch(supabase, params.data.id);
    return NextResponse.json({ batch });
  } catch (error) {
    console.error("stock audit get batch", error);
    const message = error instanceof Error ? error.message : "";
    const status = /not found/i.test(message) ? 404 : 500;
    return NextResponse.json(
      { error: status === 404 ? "ไม่พบชุดตรวจนับ" : "โหลดชุดตรวจนับไม่สำเร็จ" },
      { status }
    );
  }
}
