import { PriceRow, StockRow } from "@/lib/types/models";
import { ColumnDef } from "@tanstack/react-table";

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

export const skuDetailPriceColumns: ColumnDef<PriceRow>[] = [
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
];

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
