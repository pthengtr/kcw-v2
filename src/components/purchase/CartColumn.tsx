"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { PurchaseLineDraft } from "@/lib/types/models";

const money = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type Actions = {
  updateLine: (temp_id: string, patch: Partial<PurchaseLineDraft>) => void;
  removeLine: (temp_id: string) => void;
};

export function makeCartColumns(
  actions: Actions
): ColumnDef<PurchaseLineDraft>[] {
  return [
    {
      id: "SKU",
      accessorKey: "sku_code",
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
      accessorKey: "base_uom",
      header: "UOM",
      cell: ({ getValue }) => <span>{String(getValue() ?? "")}</span>,
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
      id: "unit_cost",
      header: "Unit Cost (Excl.)",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <Input
            className="w-28 text-right"
            type="number"
            step="0.01"
            min="0"
            value={r.unit_cost}
            onChange={(e) =>
              actions.updateLine(r.temp_id, {
                unit_cost: Number(e.target.value),
              })
            }
          />
        );
      },
      meta: { align: "right" },
    },
    {
      id: "unit_cost_inc_tax",
      header: "Unit Cost (Incl.)",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <Input
            className="w-28 text-right"
            type="number"
            step="0.01"
            min="0"
            value={r.unit_cost_inc_tax}
            onChange={(e) =>
              actions.updateLine(r.temp_id, {
                unit_cost_inc_tax: Number(e.target.value),
              })
            }
          />
        );
      },
      meta: { align: "right" },
    },
    {
      id: "line_discount_amount",
      header: "Disc",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <Input
            className="w-24 text-right"
            type="number"
            step="0.01"
            min="0"
            value={r.line_discount_amount ?? 0}
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
      id: "effective_tax_rate",
      header: "VAT %",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <Input
            className="w-20 text-right"
            type="number"
            step="0.01"
            min="0"
            value={r.effective_tax_rate ?? 0}
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
      id: "line_total_preview",
      header: "Line Total",
      accessorFn: (r) => {
        const qty = Number(r.qty || 0);
        const unit = Number(r.unit_cost || 0);
        const disc = Number(r.line_discount_amount || 0);
        const rate = Number(r.effective_tax_rate || 0) / 100;

        const gross = +(qty * unit).toFixed(2);
        const taxable = +Math.max(0, gross - disc).toFixed(2);
        const vat = +(taxable * rate).toFixed(2);
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
