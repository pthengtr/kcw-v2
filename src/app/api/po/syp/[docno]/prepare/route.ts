import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { PO_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { upsertSypPrepare } from "@/lib/po/po-queries";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ docno: string }> };

const BodySchema = z.object({
  prepared: z.boolean(),
  note: z.string().max(500).nullable().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
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
    const row = await upsertSypPrepare({
      supabase,
      docno,
      prepared: parsed.data.prepared,
      note: parsed.data.note ?? null,
      userId: permCheck.userId,
    });
    return NextResponse.json({ row });
  } catch (error) {
    console.error("po syp prepare", error);
    return NextResponse.json(
      { error: "Unable to update prepare status" },
      { status: 500 }
    );
  }
}
