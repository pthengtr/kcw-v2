"use client";

import { ColumnDef, HeaderContext } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/common/DataTableColumnHeader";
import { ItemYearRow } from "../ExpenseDashboardPage";

// ---- Labels (Thai display) ----
export const itemYearFieldLabel = {
  item_name: "หมวดหมู่",
  January: "มกราคม",
  February: "กุมภาพันธ์",
  March: "มีนาคม",
  April: "เมษายน",
  May: "พฤษภาคม",
  June: "มิถุนายน",
  July: "กรกฎาคม",
  August: "สิงหาคม",
  September: "กันยายน",
  October: "ตุลาคม",
  November: "พฤศจิกายน",
  December: "ธันวาคม",
  total: "รวมทั้งปี",
} as const;

export const defaultItemYearColumnVisibility = {
  // example: hide nothing by default
  // January: false,
};

// Optional: THB formatter (or pass your own)
const thb = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(n);

// ---- Reusable helpers (mirrors your simpleText) ----
function textCol<K extends keyof typeof itemYearFieldLabel>(key: K) {
  return {
    id: itemYearFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ItemYearRow, unknown>) => (
      <DataTableColumnHeader column={column} title={itemYearFieldLabel[key]} />
    ),
    // default cell just shows text (for item_name)
  } as ColumnDef<ItemYearRow>;
}

function numberCol<K extends keyof ItemYearRow>(
  key: K,
  opts?: { format?: (v: number) => string }
) {
  return {
    id: String(key),
    accessorKey: key as string,
    header: ({ column }: HeaderContext<ItemYearRow, unknown>) => (
      <DataTableColumnHeader
        column={column}
        title={
          itemYearFieldLabel[key as keyof typeof itemYearFieldLabel] ??
          String(key)
        }
      />
    ),
    cell: ({ getValue }) => {
      const v = Number(getValue<number>() ?? 0);
      const txt = opts?.format ? opts.format(v) : v.toLocaleString("th-TH");
      return <div className="text-right tabular-nums">{txt}</div>;
    },
    meta: { isNumeric: true },
  } as ColumnDef<ItemYearRow>;
}

// ---- Columns definition ----
export const itemYearColumns: ColumnDef<ItemYearRow>[] = [
  textCol("item_name"),
  numberCol("January", { format: thb }),
  numberCol("February", { format: thb }),
  numberCol("March", { format: thb }),
  numberCol("April", { format: thb }),
  numberCol("May", { format: thb }),
  numberCol("June", { format: thb }),
  numberCol("July", { format: thb }),
  numberCol("August", { format: thb }),
  numberCol("September", { format: thb }),
  numberCol("October", { format: thb }),
  numberCol("November", { format: thb }),
  numberCol("December", { format: thb }),
  numberCol("total", { format: thb }),
];
