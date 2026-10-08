import { NextResponse } from "next/server";

import { requireVatRegisterWrite } from "@/lib/vat/access";
import { createAdminClient } from "@/lib/supabase/admin";

const LINE_KEY = /^[a-f0-9]{32}$/;
const FILE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "vat-documents";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ lineKey: string; fileId: string }> }
) {
  const permCheck = await requireVatRegisterWrite();
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const { lineKey, fileId } = await context.params;
  if (!LINE_KEY.test(lineKey) || !FILE_ID.test(fileId)) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .schema("ops")
      .from("vat_line_files")
      .select("id, storage_path")
      .eq("id", fileId)
      .eq("line_key", lineKey)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const storagePath = (data as { storage_path: string }).storage_path;
    const removed = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (removed.error) throw removed.error;

    const deleted = await supabase
      .schema("ops")
      .from("vat_line_files")
      .delete()
      .eq("id", fileId)
      .eq("line_key", lineKey);
    if (deleted.error) throw deleted.error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("vat register delete file", error);
    return NextResponse.json(
      { error: "Unable to delete file" },
      { status: 500 }
    );
  }
}
