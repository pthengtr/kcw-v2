import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BI_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { searchBiProducts } from "@/lib/bi/product-sales-queries";
import { createAdminClient } from "@/lib/supabase/admin";

const QuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(req: Request) {
  const permCheck = await requirePermission(BI_PAGE_KEYS.productSales);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    limit: url.searchParams.get("limit") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const products = await searchBiProducts(
      supabase,
      parsed.data.q,
      parsed.data.limit ?? 20
    );
    return NextResponse.json({ products });
  } catch (error) {
    console.error("bi product search", error);
    return NextResponse.json(
      { error: "Unable to search products" },
      { status: 500 }
    );
  }
}
