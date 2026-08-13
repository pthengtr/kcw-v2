import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { fetchProductImageKpi } from "@/lib/product-image-kpi/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 30;

const QuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function GET(req: Request) {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const kpi = await fetchProductImageKpi(supabase, {
      from: parsed.data.from ?? null,
      to: parsed.data.to ?? null,
    });
    return NextResponse.json({ kpi });
  } catch (error) {
    console.error("product image kpi", error);
    return NextResponse.json(
      { error: "โหลด KPI รูปสินค้าไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
