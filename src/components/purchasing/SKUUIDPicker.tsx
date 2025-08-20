// components/purchasing/SKUUIDPicker.tsx
"use client";

import * as React from "react";
import SKUSelect, { type SKUOption } from "@/components/common/SKUSelect";
import { createClient } from "@/lib/supabase/client";

type Props = {
  value?: string; // sku_uuid
  onChange: (v: string) => void; // '' to clear
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  locationUuid?: string; // show stock at this site
  showInactive?: boolean; // doesn't filter hydrate; SKUSelect handles filtering on search
};

type OneOrMany<T> = T | T[];
type ProductRow = { product_name: string | null };
type BarcodeRow = { barcode: string; is_primary: boolean | null };

type SkuRow = {
  sku_uuid: string;
  sku_code: string | null;
  uom_code: string;
  is_active: boolean;
  // Joins can be object or array depending on PostgREST inference; handle both.
  product: OneOrMany<ProductRow> | null;
  barcodes: BarcodeRow[] | null;
};

function first<T>(v: OneOrMany<T> | null | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : v ?? undefined;
}

function mapSkuRowToOption(row: SkuRow): SKUOption {
  return {
    sku_uuid: row.sku_uuid,
    sku_code: row.sku_code ?? null,
    product_name: first(row.product)?.product_name ?? "",
    uom_code: row.uom_code,
    is_active: !!row.is_active,
    barcodes:
      (row.barcodes ?? []).map((b) => ({
        code: b.barcode,
        is_primary: !!b.is_primary,
      })) ?? [],
  };
}

export default function SKUUIDPicker({
  value,
  onChange,
  disabled,
  error,
  placeholder = "เลือกสินค้า…",
  locationUuid,
  showInactive = true, // not used in hydrate (keeps existing inactive lines visible)
}: Props) {
  const supabase = React.useMemo(() => createClient(), []);
  const [selected, setSelected] = React.useState<SKUOption | undefined>();
  const requestIdRef = React.useRef(0);

  // hydrate selected option when value or location changes
  const hydrate = React.useCallback(
    async (skuUuid?: string, loc?: string) => {
      const rid = ++requestIdRef.current;
      if (!skuUuid) {
        if (rid === requestIdRef.current) setSelected(undefined);
        return;
      }

      // Load SKU + product + barcodes
      const { data: row, error: sErr } = await supabase
        .from("sku")
        .select(
          `
          sku_uuid, sku_code, uom_code, is_active,
          product:product( product_name ),
          barcodes:barcode( barcode, is_primary )
        `
        )
        .eq("sku_uuid", skuUuid)
        .maybeSingle();

      if (rid !== requestIdRef.current) return; // stale

      if (sErr || !row) {
        setSelected(undefined);
        return;
      }

      const option = mapSkuRowToOption(row as SkuRow);

      // Enrich stock (optional)
      if (loc) {
        const { data: sb } = await supabase
          .from("stock_balance")
          .select("qty_on_hand")
          .eq("sku_uuid", skuUuid)
          .eq("location_uuid", loc)
          .maybeSingle();

        if (rid !== requestIdRef.current) return; // stale
        option.qty_on_hand = Number(sb?.qty_on_hand ?? 0);
      }

      setSelected(option);
    },
    [supabase]
  );

  React.useEffect(() => {
    void hydrate(value, locationUuid);
  }, [value, locationUuid, hydrate]);

  return (
    <SKUSelect
      selectedSku={selected}
      setSelectedSku={(sku) => {
        setSelected(sku);
        onChange(sku?.sku_uuid ?? "");
      }}
      locationUuid={locationUuid}
      showInactive={showInactive}
      disabled={disabled}
      placeholder={placeholder}
      error={error}
    />
  );
}
