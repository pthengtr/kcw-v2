import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { fetchIncomeBlankCosts } from "@/lib/bi/income-queries";
import { createAdminClient } from "@/lib/supabase/admin";

const QuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  branch: z.enum(["HQ", "SYP", "ONLINE"]).optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
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
    limit: url.searchParams.get("limit") || undefined,
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
    const blankCosts = await fetchIncomeBlankCosts(supabase, {
      from: parsed.data.from,
      to: parsed.data.to,
      branch: parsed.data.branch ?? null,
      limit: parsed.data.limit ?? 500,
    });
    return NextResponse.json({ blankCosts });
  } catch (error) {
    console.error("bi income blank costs", error);
    return NextResponse.json(
      { error: "Unable to load blank cost lines" },
      { status: 500 }
    );
  }
}
