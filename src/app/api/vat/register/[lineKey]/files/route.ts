import { NextResponse } from "next/server";
import { z } from "zod";

import { requireVatRegisterRead, requireVatRegisterWrite } from "@/lib/vat/access";
import { monthStartIso } from "@/lib/vat/register";
import { findVatRegisterLine } from "@/lib/vat/register-queries";
import type { VatExpenseImage, VatFileKind, VatRegisterFile } from "@/lib/vat/register";
import { createAdminClient } from "@/lib/supabase/admin";

const LINE_KEY = /^[a-f0-9]{32}$/;
const BUCKET = "vat-documents";
const EXPENSE_BUCKET = "pictures";
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"],
]);

function extOf(file: File): string | null {
  const fromType = ALLOWED.get(file.type);
  if (fromType) return fromType;
  const name = file.name.toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".webp")) return "webp";
  if (name.endsWith(".pdf")) return "pdf";
  return null;
}

async function ensureEvidence(
  supabase: ReturnType<typeof createAdminClient>,
  line: NonNullable<Awaited<ReturnType<typeof findVatRegisterLine>>>,
  userId: string
) {
  const { error } = await supabase.schema("ops").from("vat_line_evidence").upsert(
    {
      line_key: line.line_key,
      branch: line.branch,
      side: line.side,
      doc_type: line.sheet,
      bill_no: line.bill_no,
      bill_date: line.bill_date,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "line_key", ignoreDuplicates: true }
  );
  if (error) throw error;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ lineKey: string }> }
) {
  const permCheck = await requireVatRegisterRead();
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const { lineKey } = await context.params;
  if (!LINE_KEY.test(lineKey)) {
    return NextResponse.json({ error: "Invalid line" }, { status: 400 });
  }

  const month = new URL(req.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const line = await findVatRegisterLine(supabase, lineKey, month);
    if (!line) {
      return NextResponse.json({ error: "Line not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .schema("ops")
      .from("vat_line_files")
      .select("id, kind, storage_path, content_type, uploaded_at")
      .eq("line_key", lineKey)
      .order("uploaded_at", { ascending: true });
    if (error) throw error;

    const files: VatRegisterFile[] = [];
    for (const row of data ?? []) {
      const record = row as {
        id: string;
        kind: VatFileKind;
        storage_path: string;
        content_type: string | null;
        uploaded_at: string;
      };
      const signed = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(record.storage_path, 60 * 60);
      if (signed.error || !signed.data?.signedUrl) continue;
      files.push({
        id: record.id,
        kind: record.kind,
        url: signed.data.signedUrl,
        content_type: record.content_type,
        uploaded_at: record.uploaded_at,
      });
    }

    const expenseFiles: VatExpenseImage[] = [];
    if (line.source_ref) {
      const folder = `public/expense_receipts/${line.source_ref}`;
      const listed = await supabase.storage.from(EXPENSE_BUCKET).list(folder);
      if (!listed.error) {
        for (const item of listed.data ?? []) {
          if (!item.name || item.name.endsWith("/")) continue;
          const path = `${folder}/${item.name}`;
          const pub = supabase.storage.from(EXPENSE_BUCKET).getPublicUrl(path);
          if (pub.data.publicUrl) {
            expenseFiles.push({ name: item.name, url: pub.data.publicUrl });
          }
        }
      }
    }

    return NextResponse.json({ files, expenseFiles });
  } catch (error) {
    console.error("vat register files", error);
    return NextResponse.json(
      { error: "Unable to load files" },
      { status: 500 }
    );
  }
}

const KindSchema = z.enum(["invoice", "receipt"]);

export async function POST(
  req: Request,
  context: { params: Promise<{ lineKey: string }> }
) {
  const permCheck = await requireVatRegisterWrite();
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const { lineKey } = await context.params;
  if (!LINE_KEY.test(lineKey)) {
    return NextResponse.json({ error: "Invalid line" }, { status: 400 });
  }

  const form = await req.formData().catch(() => null);
  const kindParsed = KindSchema.safeParse(form?.get("kind"));
  const file = form?.get("file");
  const reportMonth = String(form?.get("reportMonth") ?? "");
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(reportMonth)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }
  if (!kindParsed.success || !(file instanceof File)) {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large" }, { status: 400 });
  }
  const ext = extOf(file);
  if (!ext) {
    return NextResponse.json(
      { error: "Use a JPEG, PNG, WebP, or PDF" },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();
    const line = await findVatRegisterLine(
      supabase,
      lineKey,
      reportMonth.length === 7 ? monthStartIso(reportMonth) : reportMonth
    );
    if (!line) {
      return NextResponse.json({ error: "Line not found" }, { status: 404 });
    }

    await ensureEvidence(supabase, line, permCheck.userId);

    const storagePath = `${lineKey}/${kindParsed.data}/${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploaded = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (uploaded.error) throw uploaded.error;

    const { error } = await supabase.schema("ops").from("vat_line_files").insert({
      line_key: lineKey,
      kind: kindParsed.data,
      storage_path: storagePath,
      content_type: file.type || null,
      uploaded_by: permCheck.userId,
    });
    if (error) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("vat register upload", error);
    return NextResponse.json({ error: "Unable to upload file" }, { status: 500 });
  }
}
