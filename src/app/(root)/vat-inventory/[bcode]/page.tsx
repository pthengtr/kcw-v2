import { requirePermission } from "@/lib/auth/requirePermission";
import { VAT_INVENTORY_PAGE_KEY } from "@/lib/auth/rbac-pages";
import { VatInventoryDrillView } from "@/components/vat/VatInventoryReport";
import { loadVatInventoryProduct, vatSite } from "@/lib/vat/inventory";

export default async function VatInventoryProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ bcode: string }>;
  searchParams: Promise<{ site?: string }>;
}) {
  const perm = await requirePermission(VAT_INVENTORY_PAGE_KEY);
  if (!perm.ok) {
    return <div className="p-6 text-sm text-muted-foreground">{perm.message}</div>;
  }
  const { bcode } = await params;
  const site = vatSite((await searchParams).site);
  const detail = await loadVatInventoryProduct(decodeURIComponent(bcode), site);
  return <VatInventoryDrillView basePath="/vat-inventory" detail={detail} site={site} />;
}
