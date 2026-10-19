import { requirePermission } from "@/lib/auth/requirePermission";
import { VAT_INVENTORY_PAGE_KEY } from "@/lib/auth/rbac-pages";
import { VatInventoryListView } from "@/components/vat/VatInventoryReport";
import {
  loadVatInventoryProducts,
  loadVatInventorySummary,
  loadVatInventoryYears,
  vatSite,
  vatYear,
} from "@/lib/vat/inventory";

export default async function VatInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; offset?: string; site?: string; year?: string }>;
}) {
  const perm = await requirePermission(VAT_INVENTORY_PAGE_KEY);
  if (!perm.ok) {
    return <div className="p-6 text-sm text-muted-foreground">{perm.message}</div>;
  }
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const site = vatSite(params.site);
  const years = await loadVatInventoryYears();
  const year = vatYear(params.year, years);
  const offset = Math.max(0, Number(params.offset) || 0);
  const [summary, list] = await Promise.all([
    loadVatInventorySummary(site, year),
    loadVatInventoryProducts(search, offset, site, year),
  ]);
  return (
    <VatInventoryListView
      basePath="/vat-inventory"
      summary={summary}
      list={list}
      search={search}
      offset={offset}
      site={site}
      year={year}
      years={years}
    />
  );
}
