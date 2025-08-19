"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, FilterX, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------- Types (match v_dn_list view) ----------
export type DocStatus = "DRAFT" | "POSTED" | "VOID";

export type VDnListRow = {
  dn_uuid: string;
  dn_number: string | null;
  dn_date: string; // yyyy-mm-dd
  status: DocStatus;
  supplier_name: string;
  location_code: string;
  location_name: string;
  line_count: number;
  created_at: string; // timestamp
};

// ---------- Small UI helpers ----------
function StatusPill({ status }: { status: DocStatus }) {
  const base =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs";
  const tone =
    status === "POSTED"
      ? "border-emerald-300 text-emerald-700 bg-emerald-50"
      : status === "DRAFT"
      ? "border-amber-300 text-amber-700 bg-amber-50"
      : "border-rose-300 text-rose-700 bg-rose-50";
  return <span className={cn(base, tone)}>{status}</span>;
}

function ColumnHeader({
  title,
  onClick,
  sorted,
}: {
  title: string;
  onClick?: () => void;
  sorted?: "asc" | "desc" | false;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 hover:opacity-80"
    >
      <span>{title}</span>
      <ArrowUpDown
        className={cn("h-3.5 w-3.5", sorted ? "opacity-100" : "opacity-40")}
      />
    </button>
  );
}

// ---------- Columns ----------
const columns: ColumnDef<VDnListRow>[] = [
  {
    accessorKey: "dn_number",
    header: ({ column }) => (
      <ColumnHeader
        title="DN No"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        sorted={column.getIsSorted() as "asc" | "desc" | false}
      />
    ),
    cell: ({ row }) => (
      <span className="truncate">{row.original.dn_number ?? "—"}</span>
    ),
    size: 160,
  },
  {
    accessorKey: "dn_date",
    header: ({ column }) => (
      <ColumnHeader
        title="Date"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        sorted={column.getIsSorted() as "asc" | "desc" | false}
      />
    ),
    cell: ({ row }) => {
      const d = new Date(row.original.dn_date);
      return <span>{d.toLocaleDateString()}</span>;
    },
    size: 140,
  },
  {
    accessorKey: "supplier_name",
    header: ({ column }) => (
      <ColumnHeader
        title="Supplier"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        sorted={column.getIsSorted() as "asc" | "desc" | false}
      />
    ),
    cell: ({ row }) => (
      <span className="truncate">{row.original.supplier_name}</span>
    ),
    size: 260,
  },
  {
    id: "location",
    header: ({ column }) => (
      <ColumnHeader
        title="Location"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        sorted={column.getIsSorted() as "asc" | "desc" | false}
      />
    ),
    accessorFn: (r) => `${r.location_code} — ${r.location_name}`,
    cell: ({ getValue }) => (
      <span className="truncate">{getValue<string>()}</span>
    ),
    size: 280,
  },
  {
    accessorKey: "line_count",
    header: ({ column }) => (
      <ColumnHeader
        title="Lines"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        sorted={column.getIsSorted() as "asc" | "desc" | false}
      />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.line_count}</span>
    ),
    size: 90,
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <ColumnHeader
        title="Status"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        sorted={column.getIsSorted() as "asc" | "desc" | false}
      />
    ),
    cell: ({ row }) => <StatusPill status={row.original.status} />,
    enableColumnFilter: true,
    size: 120,
  },
];

// ---------- Table component ----------
export default function DNListTable({ rows }: { rows: VDnListRow[] }) {
  const router = useRouter();

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "created_at", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = React.useState<string>("");

  // Add a hidden "created_at" column for initial sorting
  const cols = React.useMemo<ColumnDef<VDnListRow>[]>(() => {
    return [
      ...columns,
      {
        accessorKey: "created_at",
        header: () => null,
        cell: () => null,
        enableSorting: true,
        enableHiding: true,
        size: 0,
      },
    ];
  }, []);

  const table = useReactTable({
    data: rows,
    columns: cols,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const v = filterValue.trim().toLowerCase();
      if (!v) return true;
      // Search across a few fields
      const target = [
        row.original.dn_number ?? "",
        row.original.supplier_name,
        row.original.location_code,
        row.original.location_name,
        row.original.status,
      ]
        .join(" ")
        .toLowerCase();
      return target.includes(v);
    },
    defaultColumn: { size: 160 },
    columnResizeMode: "onChange",
  });

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 opacity-50" />
          <Input
            placeholder="Search DN no, supplier, location…"
            className="pl-8"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
        </div>
        {globalFilter && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setGlobalFilter("")}
            title="Clear filters"
          >
            <FilterX className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border bg-background">
        <table className="w-full text-sm">
          <colgroup>{/* Optional: set widths */}</colgroup>
          <thead className="border-b bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="h-10">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{
                      width: header.getSize() ? header.getSize() : undefined,
                    }}
                    className="px-3 text-left font-medium text-muted-foreground"
                  >
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
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getAllColumns().length}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No records
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="h-11 border-b hover:bg-accent/40 cursor-pointer"
                  onClick={() =>
                    router.push(`/purchasing/dn/${row.original.dn_uuid}`)
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 align-middle">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer summary */}
      <div className="text-xs text-muted-foreground">
        Showing {table.getRowModel().rows.length} of {rows.length}
      </div>
    </div>
  );
}
