"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  FilterX,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SSRDatePicker } from "../common/SSRDatePicker";

// put this near the top of DNListTableSSR.tsx (module scope is fine)
const dateFmt = new Intl.DateTimeFormat("th-TH", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

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

type Props = {
  rows: VDnListRow[];
  page: number;
  pageSize: number;
  pageCount: number;
  totalCount: number;
  q: string;
  status: DocStatus | "ALL";
  sort:
    | "created_at"
    | "dn_date"
    | "dn_number"
    | "supplier_name"
    | "location_code"
    | "status"
    | "line_count";
  order: "asc" | "desc";
  from?: string;
  to?: string;
};

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

function SortHeader({
  title,
  active,
  direction,
  onToggle,
}: {
  title: string;
  active: boolean;
  direction: "asc" | "desc";
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1 hover:opacity-80"
      aria-label={`Sort by ${title}`}
    >
      <span>{title}</span>
      <ArrowUpDown
        className={cn("h-3.5 w-3.5", active ? "opacity-100" : "opacity-40")}
      />
      {active && (
        <span className="sr-only">
          {direction === "asc" ? "ascending" : "descending"}
        </span>
      )}
    </button>
  );
}

export default function DNListTableSSR(props: Props) {
  const {
    rows,
    page,
    pageSize,
    pageCount,
    totalCount,
    q,
    status,
    sort,
    order,
    from,
    to,
  } = props;
  const router = useRouter();
  const sp = useSearchParams();

  const search = sp?.toString() ?? "";

  const updateQuery = React.useCallback(
    (next: Partial<Record<string, string | number | undefined>>) => {
      const params = new URLSearchParams(search);
      for (const [k, v] of Object.entries(next)) {
        if (v == null || v === "") params.delete(k);
        else params.set(k, String(v));
      }
      if (!("page" in next)) params.set("page", "1");
      router.push(`/purchasing/dn?${params.toString()}`);
    },
    [router, search] // re-create when URL changes
  );

  const [searchText, setSearchText] = React.useState<string>(q);

  // Build columns explicitly (no post-map) to satisfy ColumnDef<VDnListRow>[]
  const columns: ColumnDef<VDnListRow>[] = React.useMemo(
    () => [
      {
        accessorKey: "dn_number",
        header: () => (
          <SortHeader
            title="DN No"
            active={sort === "dn_number"}
            direction={sort === "dn_number" ? order : "desc"}
            onToggle={() =>
              updateQuery({
                sort: "dn_number",
                order: sort === "dn_number" && order === "asc" ? "desc" : "asc",
              })
            }
          />
        ),
        cell: ({ row }) => (
          <span className="truncate">{row.original.dn_number ?? "—"}</span>
        ),
        size: 160,
      },
      {
        accessorKey: "dn_date",
        header: () => (
          <SortHeader
            title="Date"
            active={sort === "dn_date"}
            direction={sort === "dn_date" ? order : "desc"}
            onToggle={() =>
              updateQuery({
                sort: "dn_date",
                order: sort === "dn_date" && order === "asc" ? "desc" : "asc",
              })
            }
          />
        ),
        cell: ({ row }) => {
          // dn_date is "YYYY-MM-DD" (no time)
          const d = new Date(`${row.original.dn_date}T00:00:00Z`);
          return <span>{dateFmt.format(d)}</span>; // always "DD/MM/YYYY"
        },
        size: 140,
      },
      {
        accessorKey: "supplier_name",
        header: () => (
          <SortHeader
            title="Supplier"
            active={sort === "supplier_name"}
            direction={sort === "supplier_name" ? order : "desc"}
            onToggle={() =>
              updateQuery({
                sort: "supplier_name",
                order:
                  sort === "supplier_name" && order === "asc" ? "desc" : "asc",
              })
            }
          />
        ),
        cell: ({ row }) => (
          <span className="truncate">{row.original.supplier_name}</span>
        ),
        size: 280,
      },
      {
        id: "location",
        accessorFn: (r) => `${r.location_code} — ${r.location_name}`,
        header: () => (
          <SortHeader
            title="Location"
            active={sort === "location_code"}
            direction={sort === "location_code" ? order : "desc"}
            onToggle={() =>
              updateQuery({
                sort: "location_code",
                order:
                  sort === "location_code" && order === "asc" ? "desc" : "asc",
              })
            }
          />
        ),
        cell: ({ getValue }) => (
          <span className="truncate">{getValue<string>()}</span>
        ),
        size: 280,
      },
      {
        accessorKey: "line_count",
        header: () => (
          <SortHeader
            title="Lines"
            active={sort === "line_count"}
            direction={sort === "line_count" ? order : "desc"}
            onToggle={() =>
              updateQuery({
                sort: "line_count",
                order:
                  sort === "line_count" && order === "asc" ? "desc" : "asc",
              })
            }
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.line_count}</span>
        ),
        size: 80,
      },
      {
        accessorKey: "status",
        header: () => (
          <SortHeader
            title="Status"
            active={sort === "status"}
            direction={sort === "status" ? order : "desc"}
            onToggle={() =>
              updateQuery({
                sort: "status",
                order: sort === "status" && order === "asc" ? "desc" : "asc",
              })
            }
          />
        ),
        cell: ({ row }) => <StatusPill status={row.original.status} />,
        size: 110,
      },
      // Hidden to keep parity with API default sorting if you ever need it:
      {
        accessorKey: "created_at",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        size: 0,
      },
    ],
    [order, sort, updateQuery] // re-render headers when sort/order change
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2 top-2.5 h-4 w-4 opacity-50" />
            <Input
              placeholder="Search DN no, supplier, location…"
              className="pl-8"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") updateQuery({ q: searchText });
              }}
            />
          </div>
          {q && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearchText("");
                updateQuery({ q: "" });
              }}
              title="Clear search"
            >
              <FilterX className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-md border px-2"
            value={status}
            onChange={(e) => updateQuery({ status: e.target.value })}
          >
            <option value="ALL">All status</option>
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Posted</option>
            <option value="VOID">Void</option>
          </select>

          <SSRDatePicker
            value={from}
            onChange={(val) => updateQuery({ from: val || undefined })}
            withTime={false} // or true if you want HH:MM in the query (becomes yyyy-MM-ddTHH:mm)
            clearable
          />
          <SSRDatePicker
            value={to}
            onChange={(val) => updateQuery({ to: val || undefined })}
            withTime={false}
            clearable
          />

          <select
            className="h-9 rounded-md border px-2"
            value={pageSize}
            onChange={(e) => updateQuery({ pageSize: Number(e.target.value) })}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="h-10">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
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
                    window.location.assign(
                      `/purchasing/dn/${row.original.dn_uuid}`
                    )
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

      {/* Pagination footer */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          Showing page <b>{page}</b> of <b>{pageCount}</b> • Total{" "}
          <b>{totalCount}</b>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateQuery({ page: Math.max(1, page - 1) })}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateQuery({ page: Math.min(pageCount, page + 1) })}
            disabled={page >= pageCount}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
