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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type Column<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
};

export function ServerPagedTable<T>({
  columns,
  rows,
  count,
  limit,
  offset,
  onOffsetChange,
  onLimitChange,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  count: number | null;
  limit: number;
  offset: number;
  onOffsetChange: (nextOffset: number) => void;
  onLimitChange: (nextLimit: number) => void;
  onRowClick?: (row: T) => void;
}) {
  const total = count ?? null;
  const pageIndex = Math.floor(offset / limit);
  const pageCount = total !== null ? Math.max(1, Math.ceil(total / limit)) : null;
  const canPrev = offset > 0;
  const canNext = total !== null ? offset + limit < total : rows.length === limit;

  return (
    <div className="rounded-md border p-4 flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex-1">
          {total !== null
            ? `แสดง ${rows.length} จากทั้งหมด ${total} รายการ`
            : `แสดง ${rows.length} รายการ`}
        </div>
        <div className="flex items-center gap-2">
          <span>รายการ/หน้า</span>
          <Select
            value={String(limit)}
            onValueChange={(v) => {
              const next = Number(v);
              onLimitChange(next);
              onOffsetChange(0);
            }}
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
          <div className="px-2">
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

      <Table className="overflow-scroll relative">
        <TableHeader className="sticky top-0 bg-white [&_tr]:border-b-0 z-10 shadow-sm">
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.key} className={c.className}>
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row, idx) => (
              <TableRow
                key={idx}
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
              <TableCell colSpan={columns.length} className="h-24 text-center">
                ไม่พบข้อมูล
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

