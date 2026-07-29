import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { PO_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { fetchPoAccountDetail } from "@/lib/po/po-queries";
import { createAdminClient } from "@/lib/supabase/admin";

const QuerySchema = z.object({
  site: z.enum(["HQ", "SYP"]).default("HQ"),
  docno: z.string().optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ acctno: string }> }
) {
  const permCheck = await requirePermission(PO_PAGE_KEYS.status);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const { acctno: rawAcctno } = await ctx.params;
  const acctno = decodeURIComponent(rawAcctno ?? "").trim();
  if (!acctno) {
    return NextResponse.json({ error: "Missing acctno" }, { status: 400 });
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    site: url.searchParams.get("site") ?? undefined,
    docno: url.searchParams.get("docno") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const account = await fetchPoAccountDetail({
      supabase,
      acctno,
      site: parsed.data.site,
      docno: parsed.data.docno,
    });
    return NextResponse.json({ account });
  } catch (error) {
    console.error("po account detail", error);
    return NextResponse.json(
      { error: "Unable to load account detail" },
      { status: 500 }
    );
  }
}
