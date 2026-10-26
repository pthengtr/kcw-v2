import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { SALES_BILL_READ_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { fifoSiteForBillnos } from "@/lib/bank/fifo-margin";
import { loadSaleFifo } from "@/lib/bank/fifo-margin-query";

const BodySchema = z.object({
  billnos: z.array(z.string().trim().min(1).max(40)).max(5000),
  site: z.enum(["hq", "syp"]).nullable().optional(),
});

export async function POST(req: Request) {
  const permCheck = await requirePermission(SALES_BILL_READ_PAGE_KEYS);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.message }, { status: permCheck.status });
  }

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid body", details: body.error.flatten() },
      { status: 400 }
    );
  }

  const site = body.data.site === undefined ? fifoSiteForBillnos(body.data.billnos) : body.data.site;
  try {
    const fifo = await loadSaleFifo(body.data.billnos, site);
    return NextResponse.json({ fifo });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "โหลดต้นทุน FIFO ไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
