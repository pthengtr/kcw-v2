import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { STOCK_AUDIT_PAGE_KEY } from "@/lib/auth/rbac-pages";
import { createStockAuditBatch } from "@/lib/stock-audit/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const BodySchema = z.object({
  branch: z.enum(["HQ", "SYP"]).default("HQ"),
  count: z.number().int().min(1).max(200).default(30),
  with_stock_only: z.boolean().optional().default(true),
  category: z.string().max(8).optional().nullable(),
  location: z.string().max(80).optional().nullable(),
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
    const batch = await createStockAuditBatch(supabase, {
      branch: parsed.data.branch,
      count: parsed.data.count,
      createdBy: permCheck.userEmail,
      withStockOnly: parsed.data.with_stock_only,
      category: parsed.data.category ?? null,
      location: parsed.data.location ?? null,
    });
    return NextResponse.json({ batch });
  } catch (error) {
    console.error("stock audit create batch", error);
    return NextResponse.json(
      { error: "สร้างชุดตรวจนับไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
