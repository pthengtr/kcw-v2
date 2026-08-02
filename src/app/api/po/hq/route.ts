import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { PO_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { listPoHeaders } from "@/lib/po/po-queries";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const QuerySchema = z.object({
  status: z.enum(["open", "billed", "all"]).default("open"),
  q: z.string().optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  months: z.coerce.number().int().min(1).max(60).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: Request) {
  const permCheck = await requirePermission(PO_PAGE_KEYS.status);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    q: url.searchParams.get("q") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    months: url.searchParams.get("months") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { rows, count } = await listPoHeaders({
      supabase,
      site: "HQ",
      status: parsed.data.status,
      q: parsed.data.q,
      from: parsed.data.from,
      to: parsed.data.to,
      months: parsed.data.months,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    return NextResponse.json({ rows, count });
  } catch (error) {
    console.error("po hq list", error);
    return NextResponse.json(
      { error: "Unable to load HQ purchase orders" },
      { status: 500 }
    );
  }
}
