// components/sku/SkuDetail.tsx
"use client";

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ProductContext,
  ProductContextType,
} from "@/components/product/ProductProvider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, RefreshCw } from "lucide-react";

import { PriceRow, SkuCatalogRowType, StockRow } from "@/lib/types/models";
import {
  makeSkuDetailPriceColumns,
  skuDetailStockColumns,
} from "./SkuDetailColumns";
import SkuDetailTable from "./SkuDetailTable";
import AdjustStockDialog from "./AdjustStockDialog";
import EditPriceDialog from "./EditPriceDialog";

type BarcodeRow = { barcode: string; is_primary: boolean };

export default function SkuDetail() {
  const {
    selectedSku, // 👈 align with your context naming
    setSelectedSku,
    openEditPriceDialog,
    setOpenEditPriceDialog,
    openAdjustStockDialog,
    setOpenAdjustStockDialog,
    setOpenAddBarcodeDialog,
  } = useContext(ProductContext) as ProductContextType;

  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [byLoc, setByLoc] = useState<StockRow[]>([]);
  const [barcodes, setBarcodes] = useState<BarcodeRow[]>([]);
  const supabase = useMemo(() => createClient(), []);

  // 1) Stateless fetcher: gets details for a given sku_uuid and returns the 3 datasets
  const fetchDetails = useCallback(
    async (supabase: ReturnType<typeof createClient>, sku_uuid: string) => {
      const [p, i, b] = await Promise.all([
        supabase
          .from("v_price_default")
          .select("sku_uuid,pack_uom_code,qty_per_pack,unit_price")
          .eq("sku_uuid", sku_uuid)
          .order("qty_per_pack", { ascending: true }),

        supabase
          .from("v_inventory_by_location")
          .select(
            "sku_uuid,sku_code,base_uom,location_uuid,location_code,on_hand"
          )
          .eq("sku_uuid", sku_uuid)
          .order("location_code", { ascending: true }),

        supabase
          .from("barcode")
          .select("barcode,is_primary")
          .eq("sku_uuid", sku_uuid)
          .order("is_primary", { ascending: false })
          .order("barcode", { ascending: true }),
      ]);

      return {
        prices: (p.data ?? []) as PriceRow[],
        byLoc: (i.data ?? []) as StockRow[],
        barcodes: (b.data ?? []) as BarcodeRow[],
      };
    },
    []
  );

  // 2) Stateful reloader: uses current selection by default, but can accept a row
  const reloadDetails = useCallback(
    async (row?: SkuCatalogRowType) => {
      const target = row ?? selectedSku;
      if (!target) {
        setPrices([]);
        setByLoc([]);
        setBarcodes([]);
        return;
      }

      setLoading(true);
      const currentId = target.sku_uuid; // capture to avoid race overwrites
      const data = await fetchDetails(supabase, currentId);

      // if selection changed mid-flight, don't overwrite with stale data
      if (selectedSku && selectedSku.sku_uuid !== currentId) {
        return;
      }

      setPrices(data.prices);
      setByLoc(data.byLoc);
      setBarcodes(data.barcodes);
      setLoading(false);
    },
    [fetchDetails, selectedSku, supabase]
  );

  // 3) Effect just calls reloadDetails() when the selection changes
  useEffect(() => {
    reloadDetails();
  }, [reloadDetails]);

  // 4) Use reloadDetails() anywhere else, e.g. after dialogs:
  // <EditPriceDialog onSaved={() => reloadDetails()} ... />
  // <AdjustStockDialog onSaved={() => reloadDetails()} ... />

  if (!selectedSku) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">SKU detail</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Select a row to see details.
        </CardContent>
      </Card>
    );
  }

  const { sku_code, product_name, base_uom, primary_barcode } = selectedSku;

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {sku_code} <span className="opacity-60">•</span> {product_name}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(sku_code)}
                title="Copy SKU code"
              >
                <Copy className="h-4 w-4 mr-1" /> Copy SKU
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedSku(undefined)}
                title="Clear selection"
              >
                Clear
              </Button>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Base UOM: <b>{base_uom}</b>
            <span className="mx-2">•</span>
            Primary barcode: <b>{primary_barcode ?? "—"}</b>
          </div>
        </CardHeader>

        <CardContent className="grid gap-6 md:grid-cols-2">
          {/* Prices */}
          <section className="h-fit">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Prices (DEFAULT)</h3>
              <span className="text-xs text-muted-foreground">
                {prices.length} row(s)
              </span>
            </div>
            <SkuDetailTable
              tableName="sku_detail_prices"
              columns={makeSkuDetailPriceColumns(() => reloadDetails())}
              data={prices}
            />
          </section>

          {/* Stock by location */}
          <section className="h-fit">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">On-hand by location</h3>
              {loading ? (
                <span className="text-xs text-muted-foreground flex items-center">
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Loading
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSku({ ...selectedSku })}
                >
                  <RefreshCw className="h-4 w-4 mr-1" /> Refresh
                </Button>
              )}
            </div>
            <SkuDetailTable
              tableName="sku_detail_stock_by_location"
              columns={skuDetailStockColumns}
              data={byLoc}
            />
          </section>

          {/* Barcodes */}
          <section className="md:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Barcodes</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpenAddBarcodeDialog(true)}
                >
                  Add barcode
                </Button>

                {/* dialogs at the bottom of the component */}
                <EditPriceDialog
                  open={openEditPriceDialog}
                  onOpenChange={setOpenEditPriceDialog}
                  sku_uuid={selectedSku.sku_uuid}
                  base_uom={selectedSku.base_uom}
                  onSaved={() => {
                    // re-fetch prices for this SKU
                    reloadDetails(); // your existing function that refreshes prices/stock
                  }}
                />

                <AdjustStockDialog
                  open={openAdjustStockDialog}
                  onOpenChange={setOpenAdjustStockDialog}
                  sku_uuid={selectedSku.sku_uuid}
                  onSaved={() => {
                    // re-fetch stock by location for this SKU
                    reloadDetails();
                  }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {barcodes.map((b) => (
                <Badge
                  key={b.barcode}
                  variant={b.is_primary ? "default" : "secondary"}
                >
                  {b.barcode}
                  {b.is_primary ? " • primary" : ""}
                </Badge>
              ))}
              {barcodes.length === 0 && (
                <div className="text-sm text-muted-foreground">No barcodes</div>
              )}
            </div>
          </section>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Fetching details…
        </div>
      )}
    </div>
  );
}
