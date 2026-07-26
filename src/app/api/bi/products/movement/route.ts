import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { fetchProductMovement } from "@/lib/bi/product-movement-queries";
import { createAdminClient } from "@/lib/supabase/admin";

const QuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  branch: z.enum(["HQ", "SYP", "ONLINE"]).optional(),
  stock_limit: z.coerce.number().int().min(1).max(200).optional(),
  dead_limit: z.coerce.number().int().min(1).max(500).optional(),
  dead_offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return NextResponse.json(
      { error: adminCheck.message },
      { status: adminCheck.status }
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
    });
    return NextResponse.json({ overview });
  } catch (error) {
    console.error("bi product movement", error);
    return NextResponse.json(
      { error: "Unable to load product movement" },
      { status: 500 }
    );
  }
}
