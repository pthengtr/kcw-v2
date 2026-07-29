"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import TableLoadingState from "@/components/common/TableLoadingState";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
};

function PaginationControls({
  loading,
  total,
  rowsLength,
  limit,
  offset,
  onOffsetChange,
  onLimitChange,
}: {
  loading: boolean;
  total: number | null;
  rowsLength: number;
  limit: number;
  offset: number;
  onOffsetChange: (nextOffset: number) => void;
  onLimitChange: (nextLimit: number) => void;
}) {
  const pageIndex = Math.floor(offset / limit);
  const pageCount =
    total !== null ? Math.max(1, Math.ceil(total / limit)) : null;
  const canPrev = !loading && offset > 0;
  const canNext =
    !loading &&
    (total !== null ? offset + limit < total : rowsLength === limit);

  return (
    <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        {loading
          ? "กำลังโหลด…"
          : total !== null
            ? `แสดง ${rowsLength} จากทั้งหมด ${total} รายการ`
            : `แสดง ${rowsLength} รายการ`}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="whitespace-nowrap">รายการ/หน้า</span>
        <Select
          value={String(limit)}
          onValueChange={(v) => {
            const next = Number(v);
            onLimitChange(next);
            onOffsetChange(0);
          }}
          disabled={loading}
        >
          <SelectTrigger className="h-8 w-[90px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[20, 50, 100, 200].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="px-2 whitespace-nowrap">
          หน้า {pageIndex + 1}
          {pageCount !== null ? ` / ${pageCount}` : ""}
        </div>
        <Button
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
          disabled={!canPrev}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => onOffsetChange(offset + limit)}
          disabled={!canNext}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export function ServerPagedTable<T>({
  columns,
  rows,
  count,
  limit,
  offset,
  onOffsetChange,
  onLimitChange,
  onRowClick,
  loading = false,
  tableMinWidthClassName = "min-w-[56rem]",
  mobileCardRender,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  count: number | null;
  limit: number;
  offset: number;
  onOffsetChange: (nextOffset: number) => void;
  onLimitChange: (nextLimit: number) => void;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  /** Keeps columns from crushing badges/status chips when the viewport is narrow. */
  tableMinWidthClassName?: string;
  /** When set, renders a card list below `md` and the table from `md` up. */
  mobileCardRender?: (row: T) => React.ReactNode;
  rowKey?: (row: T, index: number) => string | number;
}) {
  const total = count ?? null;

  const pagination = (
    <PaginationControls
      loading={loading}
      total={total}
      rowsLength={rows.length}
      limit={limit}
      offset={offset}
      onOffsetChange={onOffsetChange}
      onLimitChange={onLimitChange}
    />
  );

  const table = (
    <div className="overflow-x-auto -mx-3 sm:mx-0">
      <Table className={cn("relative w-full", tableMinWidthClassName)}>
        <TableHeader className="sticky top-0 bg-white [&_tr]:border-b-0 z-10 shadow-sm">
          <TableRow>
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className={cn("whitespace-nowrap", c.className)}
              >
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && !rows.length ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="p-0">
                <TableLoadingState />
              </TableCell>
            </TableRow>
          ) : rows.length ? (
            rows.map((row, idx) => (
              <TableRow
                key={rowKey ? rowKey(row, idx) : idx}
                className={onRowClick ? "cursor-pointer" : undefined}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((c) => (
                  <TableCell key={c.key} className={c.className}>
                    {c.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                ไม่พบข้อมูล
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  if (!mobileCardRender) {
    return (
      <div className="rounded-md border p-3 sm:p-4 flex flex-col gap-3 h-full">
        {pagination}
        {table}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="md:hidden flex flex-col gap-3 rounded-md border p-3">
        {pagination}
        {loading && !rows.length ? (
          <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
            กำลังโหลด…
          </div>
        ) : rows.length ? (
          <div className="flex flex-col gap-2">
            {rows.map((row, idx) => (
              <div key={rowKey ? rowKey(row, idx) : idx}>
                {mobileCardRender(row)}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
            ไม่พบข้อมูล
          </div>
        )}
      </div>

      <div className="hidden md:block rounded-md border p-3 sm:p-4 flex flex-col gap-3">
        {pagination}
        {table}
      </div>
    </div>
  );
}
