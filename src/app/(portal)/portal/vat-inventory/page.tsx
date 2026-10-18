import { VatInventoryListView } from "@/components/vat/VatInventoryReport";
import {
  loadVatInventoryProducts,
  loadVatInventorySummary,
} from "@/lib/vat/inventory";

export default async function PortalVatInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; offset?: string }>;
}) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const offset = Math.max(0, Number(params.offset) || 0);
  const [summary, list] = await Promise.all([
    loadVatInventorySummary(),
    loadVatInventoryProducts(search, offset),
  ]);
  return (
    <VatInventoryListView
      basePath="/portal/vat-inventory"
      summary={summary}
      list={list}
      search={search}
      offset={offset}
    />
  );
}
