import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { PO_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { fetchPiDetail } from "@/lib/po/po-queries";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ billno: string }> };

export const maxDuration = 60;

export async function GET(_req: Request, { params }: Params) {
  const permCheck = await requirePermission(PO_PAGE_KEYS.status);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const { billno: raw } = await params;
  const billnoOrRcvdno = decodeURIComponent(raw ?? "").trim();
  if (!billnoOrRcvdno) {
    return NextResponse.json({ error: "Missing BILLNO / RCVDNO" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const detail = await fetchPiDetail({ supabase, billnoOrRcvdno });
    if (!detail) {
      return NextResponse.json(
        { error: "ไม่พบใบ PIMAS สำหรับเลขนี้" },
        { status: 404 }
      );
    }
    return NextResponse.json(detail);
  } catch (error) {
    console.error("po pi detail", error);
    return NextResponse.json(
      { error: "Unable to load purchase invoice" },
      { status: 500 }
    );
  }
}
