import { Table } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect } from "react";
import { setMyCookie } from "@/app/(root)/action";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  total?: number;
  tableName?: string;
}

export function DataTablePagination<TData>({
  table,
  total,
  tableName = "",
}: DataTablePaginationProps<TData>) {
  useEffect(() => {
    //console.log(table.getState().columnVisibility);
    setMyCookie(
      `${tableName}PaginationPageSize`,
      JSON.stringify(table.getState().pagination.pageSize)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, table.getState().pagination.pageSize]);

  const numberOfRowsArray = [10, 20, 50, 100, 200, 500];
  // Find index of the first element >= inputValue
  const index = numberOfRowsArray.findIndex(
    (item) => item >= table.getFilteredRowModel().rows.length
  );

  // Take all elements less than inputValue + the first element >= inputValue
  const filteredPageSize =
    index === -1 ? numberOfRowsArray : numberOfRowsArray.slice(0, index + 1);

  return (
    <>
      <div className="flex items-center justify-between px-2">
        <div className="flex-1 text-sm text-muted-foreground">
          {/* {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected. */}
          {total
            ? `${table.getFilteredRowModel().rows.length} จากทั้งหมด ${total} `
            : `ทั้งหมด ${table.getFilteredRowModel().rows.length} `}
          {} รายการ
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">รายการ/หน้า</p>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue
                  placeholder={table.getState().pagination.pageSize}
                />
              </SelectTrigger>
              <SelectContent side="top">
                {filteredPageSize.map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-22 items-center justify-center text-sm font-medium">
            หน้า {table.getState().pagination.pageIndex + 1} /{" "}
            {table.getPageCount()}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
