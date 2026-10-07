import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { SALES_BILL_READ_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { fetchPiDetail } from "@/lib/po/po-queries";
import { createAdminClient } from "@/lib/supabase/admin";

const QuerySchema = z.object({
  billno: z.string().trim().min(1).max(40),
});

function num(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(req: Request) {
  const permCheck = await requirePermission(SALES_BILL_READ_PAGE_KEYS);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    billno: url.searchParams.get("billno") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();
    const detail = await fetchPiDetail({
      supabase,
      billnoOrRcvdno: parsed.data.billno,
    });
    if (!detail) {
      return NextResponse.json({ error: "ไม่พบบิล" }, { status: 404 });
    }
    const aftertax = num(detail.header.aftertax);
    const beforetax =
      detail.header.beforetax == null || detail.header.beforetax === ""
        ? aftertax
        : num(detail.header.beforetax);
    return NextResponse.json({
      doc_type: "PIMAS",
      billno: detail.header.billno,
      bill_date: detail.header.billdate,
      acctname: detail.header.acctname,
      po: detail.header.po,
      beforetax,
      tax: 0,
      aftertax,
      discount: num(detail.header.discount),
      canceled: detail.header.canceled === "Y",
      lines: detail.lines.map((line) => ({
        bcode: line.bcode,
        detail: line.detail,
        qty: num(line.qty),
        ui: line.ui,
        price: num(line.price),
        amount: num(line.amount),
      })),
    });
  } catch (error) {
    console.error("purchase bill detail", error);
    return NextResponse.json({ error: "โหลดรายละเอียดบิลไม่สำเร็จ" }, { status: 500 });
  }
}
