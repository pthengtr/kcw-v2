"use client";

import {
  CellContext,
  ColumnDef,
  HeaderContext,
  Row,
} from "@tanstack/react-table";
import { DataTableColumnHeader } from "../common/DataTableColumnHeader";
import { Check } from "lucide-react";
import type { PaymentReminderRow } from "@/lib/types/models";

// add this near your columns file
type ReminderRow = PaymentReminderRow & {
  party?: {
    party_uuid: string;
    party_name: string;
    party_code: string | null;
  } | null;
};

/** Map field keys to Thai labels (keys must exist on PaymentReminderRow) */
const reminderFieldLabel = {
  created_at: "สร้างเมื่อ",
  last_modified: "แก้ไขเมื่อ",
  note_id: "เลขที่เอกสาร",
  bill_count: "จำนวนใบ",
  start_date: "เริ่มต้น",
  end_date: "สิ้นสุด",
  total_amount: "จำนวนเงิน (หักส่วนลดแล้ว)",
  discount: "ส่วนลด",
  user_id: "ผู้บันทึก",
  due_date: "กำหนดชำระ",
  kbiz_datetime: "เข้า KBIZ",
  payment_date: "วันโอนจริง",
  remark: "หมายเหตุ",
  party_uuid: "รหัสคู่ค้า",
  bank_info_uuid: "บัญชีธนาคาร",
} as const;

type RemKey = keyof typeof reminderFieldLabel;

export const reminderColumns: ColumnDef<PaymentReminderRow>[] = [
  // If you fetch with a join alias like:
  // .select(`..., party:party(party_uuid, party_code, party_name)`)
  // you can include this display column:
  {
    id: "คู่ค้า",
    // value type is string for this column
    // TData is ReminderRow so `row.party?...` is type-safe
    accessorFn: (row: ReminderRow): string =>
      row.party?.party_name ?? row.party_uuid ?? "—",
    header: ({ column }: HeaderContext<ReminderRow, unknown>) => (
      <DataTableColumnHeader column={column} title="คู่ค้า" />
    ),
    cell: ({ getValue }) => (
      <div className="truncate">{String(getValue() ?? "—")}</div>
    ),
    sortingFn: "alphanumeric",
  },
  {
    id: "รหัสคู่ค้า",
    // value type is string for this column
    // TData is ReminderRow so `row.party?...` is type-safe
    accessorFn: (row: ReminderRow): string =>
      row.party?.party_code ?? row.party_uuid ?? "—",
    header: ({ column }: HeaderContext<ReminderRow, unknown>) => (
      <DataTableColumnHeader column={column} title="รหัสคู่ค้า" />
    ),
    cell: ({ getValue }) => (
      <div className="truncate">{String(getValue() ?? "—")}</div>
    ),
    sortingFn: "alphanumeric",
  },
  dateThai("created_at", true),
  dateThai("last_modified", true),
  simpleText("note_id"),
  numberInt("bill_count"),
  dateThai("start_date"),
  dateThai("end_date"),
  numberFloat("total_amount"),
  numberFloat("discount"),
  simpleText("user_id"),
  dateThai("due_date"),
  dateThai("kbiz_datetime", true),
  dateThai("payment_date", true),
  simpleText("remark"),

  // สถานะ (derived from payment_date)
  {
    id: "สถานะ",
    accessorKey: "payment_date",
    header: ({ column }: HeaderContext<PaymentReminderRow, unknown>) => (
      <DataTableColumnHeader column={column} title="สถานะ" />
    ),
    cell: ({ getValue }) => (
      <div className="text-right">{getValue() ? "จ่ายแล้ว" : "ค้าง"}</div>
    ),
    filterFn: (row, columnId, filterValue) => {
      const text = (row.getValue(columnId) ? "จ่ายแล้ว" : "ค้าง") as string;
      return text.includes(String(filterValue ?? ""));
    },
  },

  // หลักฐานการจ่าย
  {
    id: "หลักฐานการจ่าย",
    accessorKey: "proof_of_payment",
    header: ({ column }: HeaderContext<PaymentReminderRow, unknown>) => (
      <DataTableColumnHeader column={column} title="หลักฐานการจ่าย" />
    ),
    cell: ({ getValue }) => (
      <div className="text-right">
        {getValue() ? (
          <div className="flex justify-center">
            <Check className="h-4 w-4" />
          </div>
        ) : (
          ""
        )}
      </div>
    ),
  },
];

/* ---------------- helpers ---------------- */

function simpleText(key: RemKey): ColumnDef<PaymentReminderRow> {
  return {
    id: reminderFieldLabel[key],
    accessorKey: key,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={reminderFieldLabel[key]} />
    ),
    cell: (row: CellContext<PaymentReminderRow, unknown>) => {
      const v = row.getValue();
      return (
        <div className="truncate">
          <>{v ?? "—"}</>
        </div>
      );
    },
    filterFn: (row, columnId, filterValue) => {
      const v = row.getValue(columnId);
      return String(v ?? "")
        .toLowerCase()
        .includes(String(filterValue ?? "").toLowerCase());
    },
  };
}

function dateThai(
  key: RemKey,
  withTime = false
): ColumnDef<PaymentReminderRow> {
  return {
    id: reminderFieldLabel[key],
    accessorKey: key,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={reminderFieldLabel[key]} />
    ),
    cell: (row: CellContext<PaymentReminderRow, unknown>) => {
      const v = row.getValue() as string | null | undefined;
      if (!v) return <div className="text-right">—</div>;
      const d = new Date(v);
      const text = d.toLocaleString("th-TH", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
      });
      return <div className="text-right">{text}</div>;
    },
    filterFn: (row, columnId, filterValue) =>
      dateFilterFn(row, columnId, filterValue),
    sortingFn: (rowA, rowB, columnId) => {
      const a = rowA.getValue(columnId) as string | null | undefined;
      const b = rowB.getValue(columnId) as string | null | undefined;
      const ta = a ? Date.parse(a) : 0;
      const tb = b ? Date.parse(b) : 0;
      return ta - tb;
    },
  };
}

function numberFloat(key: RemKey): ColumnDef<PaymentReminderRow> {
  return {
    id: reminderFieldLabel[key],
    accessorKey: key,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={reminderFieldLabel[key]} />
    ),
    cell: (row: CellContext<PaymentReminderRow, unknown>) => {
      const v = Number(row.getValue() ?? 0);
      return (
        <div className="text-right">
          {v.toLocaleString("th-TH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      );
    },
    filterFn: (row, columnId, filterValue) => {
      const v = row.getValue(columnId);
      return String(v ?? "").includes(String(filterValue ?? ""));
    },
    sortingFn: "basic",
  };
}

function numberInt(key: RemKey): ColumnDef<PaymentReminderRow> {
  return {
    id: reminderFieldLabel[key],
    accessorKey: key,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={reminderFieldLabel[key]} />
    ),
    cell: (row: CellContext<PaymentReminderRow, unknown>) => {
      const v = Number(row.getValue() ?? 0);
      return <div className="text-right">{v.toLocaleString("th-TH")}</div>;
    },
    filterFn: (row, columnId, filterValue) => {
      const v = row.getValue(columnId);
      return String(v ?? "").includes(String(filterValue ?? ""));
    },
    sortingFn: "basic",
  };
}

function dateFilterFn(
  row: Row<PaymentReminderRow>,
  columnId: string,
  filterValue: string
) {
  const v = row.getValue(columnId) as string | null | undefined;
  if (!v) return false;
  const text = new Date(v).toLocaleString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
  return text.includes(String(filterValue ?? ""));
}
