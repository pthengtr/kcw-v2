import * as XLSX from "xlsx";

import {
  VAT_MOVEMENT_KIND_LABEL,
  type VatInventoryExport,
  type VatInventoryExportMovement,
  type VatInventoryRow,
} from "@/lib/vat/inventory";

function money(value: number | null | undefined): number | "" {
  if (value == null || Number.isNaN(value)) return "";
  return value;
}

function productRows(rows: VatInventoryRow[]): (string | number)[][] {
  return [
    [
      "รหัส",
      "ชื่อ",
      "ยกมา",
      "ซื้อ VAT",
      "RV",
      "ขาย VAT",
      "TAR",
      "ปรับสต็อก",
      "คงเหลือ",
      "มูลค่า",
      "คงเหลือจริง",
    ],
    ...rows.map((row) => [
      row.bcode,
      row.descr,
      row.open_qty,
      row.purchase_qty,
      row.rv_qty,
      row.sale_qty,
      row.tar_qty,
      row.sa_qty,
      row.qty,
      row.value,
      row.actual_qty,
    ]),
  ];
}

function movementRows(rows: VatInventoryExportMovement[]): (string | number)[][] {
  return [
    [
      "รหัส",
      "ชื่อ",
      "วันที่",
      "เอกสาร",
      "ประเภท",
      "สาขา",
      "จำนวน",
      "คงเหลือ",
      "ทุนซื้อ",
      "บิลซื้อ",
      "ราคาขาย",
      "ผู้ขาย",
    ],
    ...rows.map((row) => [
      row.bcode,
      row.descr,
      row.billdate?.slice(0, 10) ?? "",
      row.billno,
      VAT_MOVEMENT_KIND_LABEL[row.kind] ?? row.kind,
      (row.site || "").toUpperCase(),
      row.qty,
      row.balance,
      money(row.unit_cost),
      row.cost_billno ?? "",
      money(row.sale_price),
      row.supplier,
    ]),
  ];
}

export function buildVatInventoryWorkbook(data: VatInventoryExport): Buffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet(productRows(data.products)),
    "คงเหลือ"
  );
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet(movementRows(data.movements)),
    "ความเคลื่อนไหว"
  );
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
