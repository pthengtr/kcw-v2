import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { STOCK_AUDIT_PAGE_KEY } from "@/lib/auth/rbac-pages";
import { markStockAudited } from "@/lib/stock-audit/queries";
import { createAdminClient } from "@/lib/supabase/admin";

const BodySchema = z.object({
  branch: z.enum(["HQ", "SYP"]).default("HQ"),
  bcode: z.string().trim().min(1).max(64),
  source: z.enum(["batch", "ondemand", "manual"]).optional().default("ondemand"),
  batch_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
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
    const result = await markStockAudited(supabase, {
      branch: parsed.data.branch,
      bcode: parsed.data.bcode,
      auditedBy: permCheck.userEmail,
      source: parsed.data.source,
      batchId: parsed.data.batch_id ?? null,
      notes: parsed.data.notes ?? null,
    });
    return NextResponse.json({ result });
  } catch (error) {
    console.error("stock audit mark", error);
    const message = error instanceof Error ? error.message : "";
    if (/Unknown bcode/i.test(message)) {
      return NextResponse.json({ error: "ไม่พบรหัสสินค้านี้" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "บันทึกการตรวจนับไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
