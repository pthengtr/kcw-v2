"use client";

import { ColumnDef } from "@tanstack/react-table";
import { PosLineDraft } from "./PosProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

const money = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function makePosCartColumns(actions: {
  updateLine: (id: string, patch: Partial<PosLineDraft>) => void;
  removeLine: (id: string) => void;
}): ColumnDef<PosLineDraft>[] {
  return [
    {
      id: "SKU",
      header: "SKU",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div>
            <div className="font-medium">{r.sku_code}</div>
            <div className="text-xs text-muted-foreground">
              {r.product_name}
            </div>
          </div>
        );
      },
    },
    {
      id: "UOM",
      header: "UOM",
      cell: ({ row }) => <span>{row.original.base_uom}</span>,
      size: 60,
    },
    {
      id: "qty",
      header: "Qty",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <Input
            className="w-24 text-right"
            type="number"
            step="1"
            min="0"
            value={r.qty}
            onChange={(e) =>
              actions.updateLine(r.temp_id, { qty: Number(e.target.value) })
            }
          />
        );
      },
      meta: { align: "right" },
    },
    {
      id: "unit_price",
      header: "Unit (Excl.)",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <Input
            className="w-28 text-right"
            type="number"
            step="0.01"
            min="0"
            value={r.unit_price}
            onChange={(e) =>
              actions.updateLine(r.temp_id, {
                unit_price: Number(e.target.value),
              })
            }
          />
        );
      },
      meta: { align: "right" },
    },
    {
      id: "unit_price_inc",
      header: "Unit (Incl.)",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <Input
            className="w-28 text-right"
            type="number"
            step="0.01"
            min="0"
            value={r.unit_price_inc_tax}
            onChange={(e) =>
              actions.updateLine(r.temp_id, {
                unit_price_inc_tax: Number(e.target.value),
              })
            }
          />
        );
      },
      meta: { align: "right" },
    },
    {
      id: "disc",
      header: "Disc",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <Input
            className="w-24 text-right"
            type="number"
            step="0.01"
            min="0"
            value={r.line_discount_amount}
            onChange={(e) =>
              actions.updateLine(r.temp_id, {
                line_discount_amount: Number(e.target.value),
              })
            }
          />
        );
      },
      meta: { align: "right" },
    },
    {
      id: "vat",
      header: "VAT %",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <Input
            className="w-20 text-right"
            type="number"
            step="0.01"
            min="0"
            value={r.effective_tax_rate}
            onChange={(e) =>
              actions.updateLine(r.temp_id, {
                effective_tax_rate: Number(e.target.value),
              })
            }
          />
        );
      },
      meta: { align: "right" },
    },
    {
      id: "line_total",
      header: "Line Total",
      accessorFn: (r) => {
        const gross = +(Number(r.qty || 0) * Number(r.unit_price || 0)).toFixed(
          2
        );
        const taxable = +Math.max(
          0,
          gross - Number(r.line_discount_amount || 0)
        ).toFixed(2);
        const vat = +(
          (taxable * Number(r.effective_tax_rate || 0)) /
          100
        ).toFixed(2);
        return +(taxable + vat).toFixed(2);
      },
      cell: ({ getValue }) => (
        <div className="text-right tabular-nums">
          {money.format(getValue<number>())}
        </div>
      ),
      meta: { align: "right" },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => actions.removeLine(r.temp_id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      },
    },
  ];
}
