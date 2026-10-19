import { VatInventoryDrillView } from "@/components/vat/VatInventoryReport";
import { loadVatInventoryProduct, vatSite } from "@/lib/vat/inventory";

export default async function PortalVatInventoryProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ bcode: string }>;
  searchParams: Promise<{ site?: string }>;
}) {
  const { bcode } = await params;
  const site = vatSite((await searchParams).site);
  const detail = await loadVatInventoryProduct(decodeURIComponent(bcode), site);
  return (
    <VatInventoryDrillView basePath="/portal/vat-inventory" detail={detail} site={site} />
  );
}
