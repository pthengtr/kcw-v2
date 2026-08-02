import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { PO_PAGE_KEYS } from "@/lib/auth/rbac-pages";

type Params = { params: Promise<{ docno: string; line: string }> };

export async function PATCH(_req: Request, { params }: Params) {
  const permCheck = await requirePermission(PO_PAGE_KEYS.status);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const { docno: rawDocno, line: rawLine } = await params;
  const docno = decodeURIComponent(rawDocno ?? "").trim();
  const line = decodeURIComponent(rawLine ?? "").trim();
  if (!docno || !line) {
    return NextResponse.json(
      { error: "Missing DOCNO or LINE" },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      error:
        "Manual line prepare is disabled. Status is derived from HQ TF/TFV bills (SIMas REMARKS → PO docno).",
    },
    { status: 409 }
  );
}
