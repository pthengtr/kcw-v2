import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { PO_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { fetchPoLines } from "@/lib/po/po-queries";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ docno: string }> };

export async function GET(_req: Request, { params }: Params) {
  const permCheck = await requirePermission(PO_PAGE_KEYS.status);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const { docno: rawDocno } = await params;
  const docno = decodeURIComponent(rawDocno ?? "").trim();
  if (!docno) {
    return NextResponse.json({ error: "Missing DOCNO" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const lines = await fetchPoLines({ supabase, site: "SYP", docno });
    return NextResponse.json({ docno, lines });
  } catch (error) {
    console.error("po syp lines", error);
    return NextResponse.json(
      { error: "Unable to load PO lines" },
      { status: 500 }
    );
  }
}
