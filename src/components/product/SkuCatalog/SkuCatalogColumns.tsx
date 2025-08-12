import { SkuCatalogRowType } from "@/lib/types/models";
import { ColumnDef } from "@tanstack/react-table";

const nfMoney = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const nfQty = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

function toNum(x: number | string | null | undefined): number | undefined {
  if (x === null || x === undefined) return undefined;
  return typeof x === "string" ? Number(x) : x;
}
function fmtMoney(x: number | string | null | undefined) {
  const n = toNum(x);
  return n === undefined || Number.isNaN(n) ? "—" : nfMoney.format(n);
}
function fmtQty(x: number | string | null | undefined) {
  const n = toNum(x);
  return n === undefined || Number.isNaN(n) ? "0" : nfQty.format(n);
}

export const skuColumns: ColumnDef<SkuCatalogRowType>[] = [
  {
    id: "SKU",
    accessorKey: "sku_code",
    header: "SKU",
    cell: ({ getValue }) => (
      <span className="font-medium">{String(getValue() ?? "")}</span>
    ),
  },
  {
    id: "Barcode",
    accessorKey: "primary_barcode",
    header: "Barcode",
    cell: ({ getValue }) => <span>{(getValue() as string) ?? "—"}</span>,
  },
  {
    id: "product_name", // 👈 NEW column
    accessorKey: "product_name",
    header: "Product",
    cell: ({ getValue }) => (
      <span className="line-clamp-1">{String(getValue() ?? "")}</span>
    ),
  },
  {
    id: "UOM",
    accessorKey: "base_uom",
    header: "UOM",
  },
  {
    id: "Price",
    header: "Price",
    accessorFn: (row) => toNum(row.price_ui1), // ensures numeric sort
    cell: ({ row, getValue }) => (
      <div className="text-right tabular-nums">
        {fmtMoney(row.original.price_ui1 ?? (getValue() as number | undefined))}
      </div>
    ),
    meta: { align: "right" },
  },
  {
    id: "Multi",
    header: "Multi",
    accessorFn: (row) => toNum(row.price_ui2), // numeric sort on the price value
    cell: ({ row }) => {
      const pack = toNum(row.original.price_ui2_pack);
      const price = row.original.price_ui2;
      return (
        <div className="text-right tabular-nums">
          {pack && pack > 1 && price
            ? `${fmtMoney(price)} / ${pack} ${row.original.base_uom}`
            : "—"}
        </div>
      );
    },
    meta: { align: "right" },
  },
  {
    id: "on_hand_total",
    header: "On hand",
    accessorFn: (row) => toNum(row.on_hand_total),
    cell: ({ row, getValue }) => (
      <div className="text-right tabular-nums">
        {fmtQty(
          row.original.on_hand_total ?? (getValue() as number | undefined)
        )}
      </div>
    ),
    meta: { align: "right" },
  },
];
