import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { PO_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { upsertSypPrepareLine } from "@/lib/po/po-queries";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ docno: string; line: string }> };

const BodySchema = z.object({
  prepared: z.boolean(),
});

export async function PATCH(req: Request, { params }: Params) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const result = await upsertSypPrepareLine({
      supabase,
      docno,
      line,
      prepared: parsed.data.prepared,
      userId: permCheck.userId,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("po syp line prepare", error);
    return NextResponse.json(
      { error: "Unable to update line prepare status" },
      { status: 500 }
    );
  }
}
