import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { VAT_INVENTORY_PAGE_KEY } from "@/lib/auth/rbac-pages";
import { loadVatInventoryExport, loadVatInventoryYears, vatSite, vatYear } from "@/lib/vat/inventory";
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
  const year = vatYear(url.searchParams.get("year") ?? undefined, await loadVatInventoryYears());

  try {
    const data = await loadVatInventoryExport(search, bcode, site, year);
    const body = buildVatInventoryWorkbook(data);
    const filename = bcode
      ? `inventory-${year}-${site}-${bcode}.xlsx`
      : `inventory-${year}-${site}.xlsx`;
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
