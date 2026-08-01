import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { PO_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import {
  PO_PENDING_RECEIVE_STATUSES,
  listPoPendingReceive,
} from "@/lib/po/po-queries";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const QuerySchema = z.object({
  site: z.enum(["HQ", "SYP"]),
  status: z.enum(PO_PENDING_RECEIVE_STATUSES).default("pending_receive"),
  q: z.string().optional(),
  vendor: z.string().optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  months: z.coerce.number().int().min(1).max(60).default(12),
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
    site: url.searchParams.get("site") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    q: url.searchParams.get("q") || undefined,
    vendor: url.searchParams.get("vendor") || undefined,
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
    const { rows, count, grain } = await listPoPendingReceive({
      supabase,
      site: parsed.data.site,
      status: parsed.data.status,
      q: parsed.data.q,
      vendor: parsed.data.vendor,
      from: parsed.data.from,
      to: parsed.data.to,
      months: parsed.data.months,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    return NextResponse.json({ rows, count, grain });
  } catch (error) {
    console.error("po pending-receive list", error);
    return NextResponse.json(
      { error: "Unable to load pending receive lines" },
      { status: 500 }
    );
  }
}
