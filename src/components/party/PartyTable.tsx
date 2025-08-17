"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil } from "lucide-react";
import { Party } from "./PartyProvider";
import { cn } from "@/lib/utils";

export default function PartyTable({
  items,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
  onEdit,
  onSelect,
  onDelete,
}: {
  items: Party[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onEdit: (p: Party) => void;
  onSelect: (p: Party) => void;
  onDelete: (p: Party) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ชื่อ</TableHead>
            <TableHead>โค้ด</TableHead>
            <TableHead>ประเภท</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead className="w-28">จัดการ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((p) => (
            <TableRow
              key={p.party_uuid}
              onClick={() => onSelect(p)}
              className={cn("cursor-pointer", "hover:bg-muted/40")}
            >
              <TableCell className="font-medium">{p.party_name}</TableCell>
              <TableCell className="text-muted-foreground">
                {p.party_code || "—"}
              </TableCell>
              <TableCell>{p.kind}</TableCell>
              <TableCell>{p.is_active ? "Active" : "Inactive"}</TableCell>
              <TableCell className="space-x-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(p);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(p);
                  }}
                >
                  ลบ
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!loading && items.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-sm text-muted-foreground"
              >
                ไม่มีข้อมูล
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between p-2">
        <div className="text-xs text-muted-foreground">
          หน้า {page} / {totalPages} • ทั้งหมด {total} รายการ
        </div>
        <div className="space-x-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            ก่อนหน้า
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            ถัดไป
          </Button>
        </div>
      </div>
    </div>
  );
}
