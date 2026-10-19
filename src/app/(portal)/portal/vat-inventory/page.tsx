import { VatInventoryListView } from "@/components/vat/VatInventoryReport";
import {
  loadVatInventoryProducts,
  loadVatInventorySummary,
  loadVatInventoryYears,
  vatSite,
  vatYear,
} from "@/lib/vat/inventory";

export default async function PortalVatInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; offset?: string; site?: string; year?: string }>;
}) {
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
      basePath="/portal/vat-inventory"
      summary={summary}
      list={list}
      search={search}
      offset={offset}
      site={site}
      year={year}
      years={years}
      showActual={false}
    />
  );
}
