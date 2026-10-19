import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { VAT_INVENTORY_PAGE_KEY } from "@/lib/auth/rbac-pages";
import { loadVatInventoryExport, vatSite } from "@/lib/vat/inventory";
import { buildVatInventoryWorkbook } from "@/lib/vat/inventory-workbook";

export async function GET(request: Request) {
  const perm = await requirePermission(VAT_INVENTORY_PAGE_KEY);
  if (!perm.ok) {
    return NextResponse.json({ error: perm.message }, { status: perm.status });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("q")?.trim() ?? "";
  const bcode = url.searchParams.get("bcode")?.trim() ?? "";
  const site = vatSite(url.searchParams.get("site") ?? undefined);

  try {
    const data = await loadVatInventoryExport(search, bcode, site);
    const body = buildVatInventoryWorkbook(data);
    const filename = bcode
      ? `inventory-${site}-${bcode}.xlsx`
      : `inventory-${site}.xlsx`;
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ส่งออกไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
