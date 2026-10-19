import { VatInventoryDrillView } from "@/components/vat/VatInventoryReport";
import {
  loadVatInventoryProduct,
  loadVatInventoryYears,
  vatSite,
  vatYear,
} from "@/lib/vat/inventory";

export default async function PortalVatInventoryProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ bcode: string }>;
  searchParams: Promise<{ site?: string; year?: string }>;
}) {
  const { bcode } = await params;
  const query = await searchParams;
  const site = vatSite(query.site);
  const year = vatYear(query.year, await loadVatInventoryYears());
  const detail = await loadVatInventoryProduct(decodeURIComponent(bcode), site, year);
  return (
    <VatInventoryDrillView basePath="/portal/vat-inventory" detail={detail} site={site} year={year} />
  );
}
