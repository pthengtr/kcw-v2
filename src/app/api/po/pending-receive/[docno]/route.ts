import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { PO_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { fetchPoPendingReceiveDetail } from "@/lib/po/po-queries";
import { createAdminClient } from "@/lib/supabase/admin";

const QuerySchema = z.object({
  site: z.enum(["HQ", "SYP"]),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ docno: string }> }
) {
  const permCheck = await requirePermission(PO_PAGE_KEYS.status);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const { docno: rawDocno } = await ctx.params;
  const docno = decodeURIComponent(rawDocno || "").trim();
  if (!docno) {
    return NextResponse.json({ error: "DOCNO required" }, { status: 400 });
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    site: url.searchParams.get("site") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const detail = await fetchPoPendingReceiveDetail({
      supabase,
      site: parsed.data.site,
      docno,
    });
    return NextResponse.json(detail);
  } catch (error) {
    console.error("po pending-receive detail", error);
    return NextResponse.json(
      { error: "Unable to load pending receive detail" },
      { status: 500 }
    );
  }
}
