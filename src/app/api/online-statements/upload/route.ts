import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import {
  isOnlineStatementFormat,
  isShopForFormat,
  ONLINE_STATEMENT_MAX_BYTES,
  validateOnlineWorkbook,
} from "@/lib/online-statements/workbook";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "online-statements";

function safeFilename(name: string): string | null {
  const base = name.split(/[/\\]/).pop()?.trim() ?? "";
  if (!base.toLowerCase().endsWith(".xlsx")) return null;
  const cleaned = base.replace(/[^\w.\-()\u0E00-\u0E7F]+/g, "_").slice(0, 180);
  if (!cleaned.toLowerCase().endsWith(".xlsx") || cleaned.includes("..")) return null;
  return cleaned;
}

export async function POST(req: Request) {
  const permCheck = await requirePermission(BANK_PAGE_KEYS.onlineStatements);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.message }, { status: permCheck.status });
  }

  const form = await req.formData();
  const formatRaw = String(form.get("format") ?? "").trim();
  const shop = String(form.get("shop") ?? "").trim();
  const file = form.get("file");
  if (!isOnlineStatementFormat(formatRaw)) {
    return NextResponse.json({ error: "เลือกรูปแบบ Lazada, Shopee, TikTok หรือ Peak" }, { status: 400 });
  }
  if (!isShopForFormat(formatRaw, shop)) {
    return NextResponse.json({ error: "เลือกร้านให้ตรงกับรูปแบบไฟล์" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "กรุณาเลือกไฟล์ Excel" }, { status: 400 });
  }
  const filename = safeFilename(file.name);
  if (!filename) {
    return NextResponse.json({ error: "รองรับเฉพาะไฟล์ .xlsx" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > ONLINE_STATEMENT_MAX_BYTES) {
    return NextResponse.json({ error: "ไฟล์ต้องไม่เกิน 15 MB" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = validateOnlineWorkbook(bytes, formatRaw);
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error }, { status: 400 });
  }

  const supabase = createAdminClient();
  const id = crypto.randomUUID();
  const storagePath = `${formatRaw}/${id}_${filename}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: false,
  });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { error: insertError } = await supabase
    .schema("curated_kcw")
    .from("online_statement_uploads")
    .insert({
      id,
      format: formatRaw,
      shop: formatRaw === "peak" ? null : shop,
      original_filename: filename,
      storage_path: storagePath,
      status: "pending",
      row_count: checked.rowCount,
      uploaded_by: permCheck.userEmail,
    });
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { data, error: jobError } = await supabase.rpc("fn_online_statement_enqueue", {
    p_requested_by: permCheck.userEmail,
  });
  if (jobError) {
    return NextResponse.json(
      { error: jobError.message, saved: true, id },
      { status: 500 }
    );
  }
  const job = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    ok: true,
    id,
    filename,
    rowCount: checked.rowCount,
    job: job ?? null,
  });
}
