// components/sku/SkuDetailColumns.ts
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export type PriceRow = {
  sku_uuid: string;
  pack_uom_code: string;
  qty_per_pack: number | string;
  unit_price: number | string;
};

export type StockRow = {
  sku_uuid: string;
  sku_code: string;
  base_uom: string;
  location_uuid: string | null;
  location_code: string | null;
  on_hand: number | string | null;
};

const nfMoney = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const nfQty = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

function toNum(x: number | string | null | undefined) {
  if (x == null) return null;
  return typeof x === "string" ? Number(x) : x;
}

/** Build columns for the Prices table with a wired Remove button */
export function makeSkuDetailPriceColumns(
  onRemoved?: () => void
): ColumnDef<PriceRow>[] {
  return [
    {
      id: "pack",
      header: "Pack",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <span>
            {r.pack_uom_code} × {Number(r.qty_per_pack)}
          </span>
        );
      },
    },
    {
      id: "unit_price",
      header: "Unit price",
      accessorFn: (r) => toNum(r.unit_price),
      cell: ({ row }) => {
        const n = toNum(row.original.unit_price);
        return (
          <div className="text-right tabular-nums">
            {n == null ? "—" : nfMoney.format(n)}
          </div>
        );
      },
      meta: { align: "right" },
    },
    {
      id: "price_per_base",
      header: "Per base UOM",
      accessorFn: (r) => {
        const price = toNum(r.unit_price);
        const pack = toNum(r.qty_per_pack) ?? 1;
        return price != null && pack > 0 ? Number(price) / Number(pack) : null;
      },
      cell: ({ getValue }) => {
        const n = toNum(getValue() as string | number);
        return (
          <div className="text-right tabular-nums">
            {n == null ? "—" : nfMoney.format(n)}
          </div>
        );
      },
      meta: { align: "right" },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const r = row.original;
        const onRemoveClick = async () => {
          // optional confirm (MVP)
          const ok = window.confirm(
            `Remove price ${r.pack_uom_code} × ${Number(r.qty_per_pack)} ?`
          );
          if (!ok) return;

          const supabase = createClient();
          const { error } = await supabase.rpc("fn_close_price", {
            in_list_name: "DEFAULT",
            in_sku_uuid: r.sku_uuid,
            in_pack_uom_code: String(r.pack_uom_code).toUpperCase(),
            in_qty_per_pack: Number(r.qty_per_pack),
            in_effective_to: null, // server will use current_date - 1
          });

          if (error) {
            console.error(error); // TODO: toast
            return;
          }
          onRemoved?.();
        };

        return (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={onRemoveClick}>
              Remove
            </Button>
          </div>
        );
      },
      meta: { align: "right" },
    },
  ];
}

export const skuDetailStockColumns: ColumnDef<StockRow>[] = [
  {
    accessorKey: "location_code",
    header: "Location",
    cell: ({ getValue }) => <span>{(getValue() as string) ?? "—"}</span>,
  },
  {
    id: "on_hand",
    header: "On hand",
    accessorFn: (r) => toNum(r.on_hand),
    cell: ({ getValue }) => {
      const n = toNum(getValue() as string | number);
      return (
        <div className="text-right tabular-nums">
          {n == null ? "0" : nfQty.format(n)}
        </div>
      );
    },
    meta: { align: "right" },
  },
];
