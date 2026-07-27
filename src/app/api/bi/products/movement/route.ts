import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BI_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { fetchProductMovement } from "@/lib/bi/product-movement-queries";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const QuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  branch: z.enum(["HQ", "SYP", "ONLINE"]).optional(),
  stock_limit: z.coerce.number().int().min(1).max(200).optional(),
  dead_limit: z.coerce.number().int().min(1).max(500).optional(),
  dead_offset: z.coerce.number().int().min(0).optional(),
  dead_sort: z
    .enum(["recent", "deep", "value_desc", "value_asc", "qty_desc", "cost_desc"])
    .optional(),
  mode: z.enum(["stock_more", "dead", "both"]).optional(),
  dead_tier: z.enum(["yellow", "orange", "red"]).optional(),
  category: z
    .string()
    .regex(/^\d{1,2}$/)
    .optional(),
});

function publicErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/timeout|canceling statement|57014/i.test(message)) {
    return "โหลดช้าเกินกำหนด ลองรีเฟรชอีกครั้ง";
  }
  return "Unable to load product movement";
}

export async function GET(req: Request) {
  const permCheck = await requirePermission(BI_PAGE_KEYS.productMovement);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    branch: url.searchParams.get("branch") || undefined,
    stock_limit: url.searchParams.get("stock_limit") || undefined,
    dead_limit: url.searchParams.get("dead_limit") || undefined,
    dead_offset: url.searchParams.get("dead_offset") || undefined,
    dead_sort: url.searchParams.get("dead_sort") || undefined,
    mode: url.searchParams.get("mode") || undefined,
    dead_tier: url.searchParams.get("dead_tier") || undefined,
    category: url.searchParams.get("category") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  if (parsed.data.from > parsed.data.to) {
    return NextResponse.json(
      { error: "from must be on or before to" },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();
    const overview = await fetchProductMovement(supabase, {
      from: parsed.data.from,
      to: parsed.data.to,
      branch: parsed.data.branch ?? null,
      stockLimit: parsed.data.stock_limit ?? 50,
      deadLimit: parsed.data.dead_limit ?? 100,
      deadOffset: parsed.data.dead_offset ?? 0,
      deadSort: parsed.data.dead_sort ?? "value_desc",
      mode: parsed.data.mode ?? "both",
      deadTier: parsed.data.dead_tier ?? null,
      category: parsed.data.category
        ? parsed.data.category.padStart(2, "0")
        : null,
    });
    return NextResponse.json({ overview });
  } catch (error) {
    console.error("bi product movement", error);
    const message = publicErrorMessage(error);
    const status = /ช้า|timeout|canceling statement|57014/i.test(message)
      ? 504
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
