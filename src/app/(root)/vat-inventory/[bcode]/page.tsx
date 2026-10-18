import { requirePermission } from "@/lib/auth/requirePermission";
import { VAT_INVENTORY_PAGE_KEY } from "@/lib/auth/rbac-pages";
import { VatInventoryDrillView } from "@/components/vat/VatInventoryReport";
import { loadVatInventoryProduct } from "@/lib/vat/inventory";

export default async function VatInventoryProductPage({
  params,
}: {
  params: Promise<{ bcode: string }>;
}) {
  const perm = await requirePermission(VAT_INVENTORY_PAGE_KEY);
  if (!perm.ok) {
    return <div className="p-6 text-sm text-muted-foreground">{perm.message}</div>;
  }
  const { bcode } = await params;
  const detail = await loadVatInventoryProduct(decodeURIComponent(bcode));
  return <VatInventoryDrillView basePath="/vat-inventory" detail={detail} />;
}
