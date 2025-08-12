// components/sku/SkuCatalogPage.tsx

import SkuCatalogTable from "./SkuCatalog/SkuCatalogTable";
import SkuSearchForm, { skuSearchDefaultValues } from "./SkuSearchForm";
import SkuDetail from "./SkuDetail/SkuDetail";

export default function SkuCatalogPage() {
  return (
    <section className="flex flex-col items-center h-[80vh] p-8 gap-4">
      <SkuSearchForm defaultValues={skuSearchDefaultValues} />
      <SkuCatalogTable />
      <SkuDetail />
    </section>
  );
}
