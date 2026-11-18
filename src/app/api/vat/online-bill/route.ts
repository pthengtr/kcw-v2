import { NextResponse } from "next/server";
import { z } from "zod";

import { requireVatRegisterRead } from "@/lib/vat/access";
import { onlineSalePrintKind } from "@/lib/vat/online-bill";
import { createAdminClient } from "@/lib/supabase/admin";

const QuerySchema = z.object({
  billno: z.string().trim().min(1).max(40),
  sheet: z.string().trim().max(20).optional(),
});

function onlineSaleBaseUrl(): string {
  return (
    process.env.ONLINE_SALE_BASE_URL?.trim() ||
    process.env.KCW_ONLINE_SALE_BASE_URL?.trim() ||
    "http://127.0.0.1:8796"
  );
}

async function fetchLivePrint(
  billno: string,
  kind: "tad" | "cntad"
): Promise<string | null> {
  const base = onlineSaleBaseUrl().replace(/\/$/, "");
  const path =
    kind === "cntad"
      ? `/online-sale/print/cntad/${encodeURIComponent(billno)}`
      : `/online-sale/print/tad/${encodeURIComponent(billno)}`;
  try {
    const res = await fetch(`${base}${path}?embed=1`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (!html.includes("class=\"rcp\"") && !html.includes("class='rcp'")) {
      return null;
    }
    return html;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const permCheck = await requireVatRegisterRead();
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    billno: url.searchParams.get("billno") ?? "",
    sheet: url.searchParams.get("sheet") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const billno = parsed.data.billno.trim().toUpperCase();
  const kind = onlineSalePrintKind(parsed.data.sheet ?? "", billno);
  if (!kind) {
    return NextResponse.json({ error: "ไม่ใช่บิล TAD/CNTAD" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("fn_vat_online_bill_html", {
    p_billno: billno,
  });
  if (error) {
    console.error("vat online-bill sheet", error);
  }
  let html = typeof data === "string" && data.trim() ? data : null;

  if (!html) {
    html = await fetchLivePrint(billno, kind);
  }

  if (!html) {
    return NextResponse.json(
      {
        error:
          "ยังไม่มีไฟล์บิลจากขายออนไลน์ — เปิดพิมพ์บิลจากหน้าขายออนไลน์หนึ่งครั้งเพื่อซิงก์ หรือรอ backfill",
      },
      { status: 404 }
    );
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=60",
    },
  });
}
