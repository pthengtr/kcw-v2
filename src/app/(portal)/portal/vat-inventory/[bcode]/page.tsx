import { VatInventoryDrillView } from "@/components/vat/VatInventoryReport";
import { loadVatInventoryProduct } from "@/lib/vat/inventory";

export default async function PortalVatInventoryProductPage({
  params,
}: {
  params: Promise<{ bcode: string }>;
}) {
  const { bcode } = await params;
  const detail = await loadVatInventoryProduct(decodeURIComponent(bcode));
  return (
    <VatInventoryDrillView basePath="/portal/vat-inventory" detail={detail} />
  );
}
