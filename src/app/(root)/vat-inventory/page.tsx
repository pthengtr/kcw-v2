import { requirePermission } from "@/lib/auth/requirePermission";
import { VAT_INVENTORY_PAGE_KEY } from "@/lib/auth/rbac-pages";
import { VatInventoryListView } from "@/components/vat/VatInventoryReport";
import {
  loadVatInventoryProducts,
  loadVatInventorySummary,
} from "@/lib/vat/inventory";

export default async function VatInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; offset?: string }>;
}) {
  const perm = await requirePermission(VAT_INVENTORY_PAGE_KEY);
  if (!perm.ok) {
    return <div className="p-6 text-sm text-muted-foreground">{perm.message}</div>;
  }
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const offset = Math.max(0, Number(params.offset) || 0);
  const [summary, list] = await Promise.all([
    loadVatInventorySummary(),
    loadVatInventoryProducts(search, offset),
  ]);
  return (
    <VatInventoryListView
      basePath="/vat-inventory"
      summary={summary}
      list={list}
      search={search}
      offset={offset}
    />
  );
}
