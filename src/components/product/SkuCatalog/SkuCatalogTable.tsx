"use client";

import { useContext, useEffect } from "react";

import { DataTable } from "../../common/DataTable";
import { ProductContext, ProductContextType } from "../ProductProvider";
import SkuCatalogTableHeader from "./SkuCatalogTableHeader";
import { skuColumns } from "./SkuCatalogColumns";

export default function SkuCatalogTable() {
  const {
    skus,
    total,
    getSkus,
    setSelectedSku,
    setSubmitError,
    openAdjustStockDialog,
    openAddBarcodeDialog,
  } = useContext(ProductContext) as ProductContextType;

  useEffect(() => {
    setSubmitError(undefined);
    getSkus();
  }, [getSkus, setSubmitError, openAdjustStockDialog, openAddBarcodeDialog]);

  return (
    <div className="h-full">
      {!!skus && (
        <DataTable
          tableName="sku_catalog"
          columns={skuColumns}
          data={skus}
          total={total}
          setSelectedRow={setSelectedSku}
        >
          <SkuCatalogTableHeader />
        </DataTable>
      )}
    </div>
  );
}
