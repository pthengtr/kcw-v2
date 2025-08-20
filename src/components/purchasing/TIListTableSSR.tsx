"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  flexRender,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type DocStatus = "DRAFT" | "POSTED" | "VOID";

export type VTiListRow = {
  ti_uuid: string;
  ti_number: string | null;
  ti_date: string; // "YYYY-MM-DD"
  status: DocStatus;
  status_text: string;
  supplier_uuid: string;
  supplier_name: string | null;
  location_uuid: string | null;
  location_code: string | null;
  location_name: string | null;
  line_count: number;
  total_before_tax: string | number | null;
  vat_amount: string | number | null;
  grand_total: string | number | null;
  created_at: string;
  posted_at: string | null;
};

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function n(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "string" ? Number(v) || 0 : v;
}

type Props = {
  rows: VTiListRow[];
  page: number;
  pageCount: number;
  totalCount: number;
  q?: string;
  from?: string;
  to?: string;
};

export default function TIListTableSSR({
  rows,
  page,
  pageCount,
  totalCount,
  q = "",
  from,
  to,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  // Local controlled inputs (always strings -> avoids Input type errors)
  const [qLocal, setQLocal] = React.useState<string>(q);
  const [fromLocal, setFromLocal] = React.useState<string>(from ?? "");
  const [toLocal, setToLocal] = React.useState<string>(to ?? "");

  const columns = React.useMemo<ColumnDef<VTiListRow>[]>(
    () => [
      {
        accessorKey: "ti_date",
        header: "Date",
        cell: ({ getValue }) => {
          const iso = String(getValue());
          const d = new Date(`${iso}T00:00:00Z`);
          return <span>{dateFmt.format(d)}</span>;
        },
      },
      {
        accessorKey: "ti_number",
        header: "TI No.",
        cell: ({ row }) => (
          <Link
            href={`/purchasing/ti/${row.original.ti_uuid}`}
            className="text-primary hover:underline"
          >
            {row.original.ti_number ?? "—"}
          </Link>
        ),
      },
      {
        accessorKey: "supplier_name",
        header: "Supplier",
        cell: ({ getValue }) => <span>{(getValue() as string) ?? "—"}</span>,
      },
      {
        accessorKey: "location_code",
        header: "Loc",
        cell: ({ getValue }) => <span>{(getValue() as string) ?? "—"}</span>,
      },
      {
        accessorKey: "line_count",
        header: () => <div className="text-right">Lines</div>,
        cell: ({ getValue }) => (
          <div className="text-right">{Number(getValue() ?? 0)}</div>
        ),
      },
      {
        accessorKey: "total_before_tax",
        header: () => <div className="text-right">Before Tax</div>,
        cell: ({ getValue }) => (
          <div className="text-right">
            {n(getValue() as number).toLocaleString()}
          </div>
        ),
      },
      {
        accessorKey: "vat_amount",
        header: () => <div className="text-right">VAT</div>,
        cell: ({ getValue }) => (
          <div className="text-right">
            {n(getValue() as number).toLocaleString()}
          </div>
        ),
      },
      {
        accessorKey: "grand_total",
        header: () => <div className="text-right">Grand</div>,
        cell: ({ getValue }) => (
          <div className="text-right font-medium">
            {n(getValue() as number).toLocaleString()}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const s = getValue() as DocStatus;
          return (
            <span
              className={cn(
                "rounded px-2 py-0.5 text-xs",
                s === "DRAFT" && "bg-amber-100 text-amber-900",
                s === "POSTED" && "bg-green-100 text-green-900",
                s === "VOID" && "bg-red-100 text-red-900"
              )}
            >
              {s}
            </span>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    // We keep sorting/pagination server-side later; for now render-only.
  });

  function updateQuery(
    next: Partial<Record<string, string | number | undefined>>
  ) {
    const params = new URLSearchParams(sp?.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined || v === "") params.delete(k);
      else params.set(k, String(v));
    }
    if (!("page" in next)) params.set("page", "1");
    router.push(`/purchasing/ti?${params.toString()}`);
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Search TI no., supplier, location"
          value={qLocal}
          onChange={(e) => setQLocal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateQuery({ q: qLocal || undefined });
          }}
          className="h-9 w-[320px]"
        />
        <Input
          type="date"
          value={fromLocal}
          onChange={(e) => setFromLocal(e.target.value)}
          onBlur={() => updateQuery({ from: fromLocal || undefined })}
          className="h-9"
        />
        <span>—</span>
        <Input
          type="date"
          value={toLocal}
          onChange={(e) => setToLocal(e.target.value)}
          onBlur={() => updateQuery({ to: toLocal || undefined })}
          className="h-9"
        />
        <Button
          variant="outline"
          onClick={() =>
            updateQuery({ q: undefined, from: undefined, to: undefined })
          }
        >
          Reset
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="h-10 text-left">
                {hg.headers.map((header) => (
                  <th key={header.id} className="px-3">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="h-11 border-t hover:bg-muted/40">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr className="h-16">
                <td
                  className="px-3 text-muted-foreground"
                  colSpan={columns.length}
                >
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pager (server-side) */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Page {page} / {pageCount} · {totalCount} rows
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => updateQuery({ page: page - 1 })}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => updateQuery({ page: page + 1 })}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
