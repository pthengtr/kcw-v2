import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { PO_PAGE_KEYS } from "@/lib/auth/rbac-pages";

type Params = { params: Promise<{ docno: string }> };

export async function PATCH(_req: Request, { params }: Params) {
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

  return NextResponse.json(
    {
      error:
        "Manual prepare is disabled. Status is derived from HQ TF/TFV bills (SIMas REMARKS → PO docno).",
    },
    { status: 409 }
  );
}
