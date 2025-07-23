"use client";

// needed for table body level scope DnD setup
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";

// needed for row & cell level scope DnD setup
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  ColumnDef,
  ColumnFiltersState,
  InitialTableState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  Header,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Input } from "../ui/input";
import { useState, CSSProperties, useEffect } from "react";
import { DataTablePagination } from "./DataTablePagination";
import { DataTableViewOptions } from "./DataTableViewOptions";
import { GripVertical } from "lucide-react";
import { setMyCookie } from "@/app/(root)/action";

interface DataTableProps<TData, TValue> {
  children?: React.ReactNode;
  tableName?: string;
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  total?: number;
  setSelectedRow?: (row: TData) => void;
  initialState?: InitialTableState | undefined;
  totalAmountKey?: string[];
}

export function DataTable<TData, TValue>({
  children,
  tableName = "",
  columns,
  data,
  total,
  setSelectedRow,
  initialState,
  totalAmountKey = [],
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    columns.map((c) => c.id!)
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    enableMultiRowSelection: false,
    onColumnOrderChange: setColumnOrder,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      columnOrder,
    },
    initialState: initialState,
  });

  useEffect(() => {
    //console.log(table.getState().columnVisibility);
    setMyCookie(
      `${tableName}ColumnVisibility`,
      JSON.stringify(table.getState().columnVisibility)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, table.getState().columnVisibility]);

  // reorder columns after drag & drop
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder((columnOrder) => {
        const oldIndex = columnOrder.indexOf(active.id as string);
        const newIndex = columnOrder.indexOf(over.id as string);
        return arrayMove(columnOrder, oldIndex, newIndex); //this is just a splice util
      });
    }
  }

  function totalAmount(key: string) {
    return table.getRowModel().rows.reduce((sum, row) => {
      const value = row.getValue(key);
      return typeof value === "number" ? sum + (value || 0) : 0;
    }, 0);
  }

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  return (
    <div className="rounded-md border p-4 flex flex-col gap-2 h-[75vh]">
      <div className="w-full flex gap-4 items-center justify-end bg-slate-50 p-4">
        {children}
        {totalAmountKey.length > 0 &&
          totalAmountKey.map((key) => (
            <div key={`total-${key}`} className="">{`รวม${key}: ${totalAmount(
              key
            ).toLocaleString("th-TH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}</div>
          ))}
        <DataTableViewOptions table={table} />
      </div>

      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragEnd={handleDragEnd}
        sensors={sensors}
      >
        <Table className="overflow-scroll relative">
          <TableHeader className="sticky top-0 bg-white [&_tr]:border-b-0 z-10 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                <SortableContext
                  items={columnOrder}
                  strategy={horizontalListSortingStrategy}
                >
                  {headerGroup.headers.map((header) => {
                    return (
                      <DraggableTableHeader key={header.id} header={header} />
                    );
                  })}
                </SortableContext>
              </TableRow>
            ))}
            {/* Filter input for each column */}
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <SortableContext
                      key={header.id}
                      items={columnOrder}
                      strategy={horizontalListSortingStrategy}
                    >
                      <DragAlongCell
                        columnSize={header.column.getSize()}
                        columnId={header.column.id}
                      >
                        {header.isPlaceholder ? null : (
                          <Input
                            value={
                              (table
                                .getColumn(header.id)
                                ?.getFilterValue() as string) ?? ""
                            }
                            onChange={(event) =>
                              table
                                .getColumn(header.id)
                                ?.setFilterValue(event.target.value)
                            }
                          ></Input>
                        )}
                      </DragAlongCell>
                    </SortableContext>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {/* Main data table */}
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => {
                    row.toggleSelected();
                    if (setSelectedRow) setSelectedRow(row.original);
                  }}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <SortableContext
                      key={cell.id}
                      items={columnOrder}
                      strategy={horizontalListSortingStrategy}
                    >
                      <DragAlongCell
                        key={cell.id}
                        columnSize={cell.column.getSize()}
                        columnId={cell.column.id}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </DragAlongCell>
                    </SortableContext>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DndContext>

      {/* Pagination button */}
      <div className="flex-1 flex flex-col justify-end">
        <DataTablePagination
          table={table}
          total={total}
          tableName={tableName}
        />
      </div>
    </div>
  );
}

interface DraggableTableHeaderProps<TData> {
  header: Header<TData, unknown>;
}

function DraggableTableHeader<TData>({
  header,
}: DraggableTableHeaderProps<TData>) {
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useSortable({
      id: header.column.id,
    });

  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: "relative",
    transform: CSS.Translate.toString(transform), // translate instead of transform to avoid squishing
    transition: "width transform 0.2s ease-in-out",
    whiteSpace: "nowrap",
    width: header.column.getSize(),
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <TableHead colSpan={header.colSpan} ref={setNodeRef} style={style}>
      <div className="flex items-center gap-4">
        <button {...attributes} {...listeners}>
          <GripVertical size={18} />
        </button>
        {header.isPlaceholder
          ? null
          : flexRender(header.column.columnDef.header, header.getContext())}
      </div>
    </TableHead>
  );
}

interface DragAlongCellProps {
  columnSize: number;
  columnId: string;
  children: React.ReactNode;
}

function DragAlongCell({ children, columnSize, columnId }: DragAlongCellProps) {
  const { isDragging, setNodeRef, transform } = useSortable({
    id: columnId,
  });

  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: "relative",
    transform: CSS.Translate.toString(transform), // translate instead of transform to avoid squishing
    transition: "width transform 0.2s ease-in-out",
    width: columnSize,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <TableCell style={style} ref={setNodeRef}>
      {children}
    </TableCell>
  );
}
