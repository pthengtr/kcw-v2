import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { STOCK_AUDIT_PAGE_KEY } from "@/lib/auth/rbac-pages";
import { lookupStockAuditProduct } from "@/lib/stock-audit/queries";
import { createAdminClient } from "@/lib/supabase/admin";

const QuerySchema = z.object({
  branch: z.enum(["HQ", "SYP"]).optional(),
  bcode: z.string().trim().min(1).max(64),
});

export async function GET(req: Request) {
  const permCheck = await requirePermission(STOCK_AUDIT_PAGE_KEY);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    branch: url.searchParams.get("branch") || undefined,
    bcode: url.searchParams.get("bcode") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const product = await lookupStockAuditProduct(supabase, {
      branch: parsed.data.branch ?? "HQ",
      bcode: parsed.data.bcode,
    });
    return NextResponse.json({ product });
  } catch (error) {
    console.error("stock audit lookup", error);
    return NextResponse.json(
      { error: "ค้นหาสินค้าไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
