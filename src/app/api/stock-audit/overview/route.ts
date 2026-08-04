import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { STOCK_AUDIT_PAGE_KEY } from "@/lib/auth/rbac-pages";
import { fetchStockAuditOverview } from "@/lib/stock-audit/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const QuerySchema = z.object({
  branch: z.enum(["HQ", "SYP"]).optional(),
  with_stock_only: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v == null ? undefined : v === "true")),
  bucket: z
    .enum(["never", "d30", "d90", "d180", "d365", "over_365"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
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
    with_stock_only: url.searchParams.get("with_stock_only") || undefined,
    bucket: url.searchParams.get("bucket") || undefined,
    limit: url.searchParams.get("limit") || undefined,
    offset: url.searchParams.get("offset") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const overview = await fetchStockAuditOverview(supabase, {
      branch: parsed.data.branch ?? "HQ",
      withStockOnly: parsed.data.with_stock_only ?? true,
      bucket: parsed.data.bucket ?? null,
      limit: parsed.data.limit ?? 50,
      offset: parsed.data.offset ?? 0,
    });
    return NextResponse.json({ overview });
  } catch (error) {
    console.error("stock audit overview", error);
    return NextResponse.json(
      { error: "โหลดภาพรวมตรวจนับไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
