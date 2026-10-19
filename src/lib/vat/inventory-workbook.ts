import * as XLSX from "xlsx";

import {
  VAT_MOVEMENT_KIND_LABEL,
  deductQty,
  movementKindLabel,
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
      "โอน",
      "คงเหลือ",
      "มูลค่า",
      "คงเหลือจริง",
      "สาขา",
    ],
    ...rows.map((row) => [
      row.bcode,
      row.descr,
      row.open_qty,
      row.purchase_qty,
      row.rv_qty,
      deductQty(row.sale_qty),
      deductQty(row.tar_qty),
      deductQty(row.sa_qty),
      row.tf_qty,
      row.qty,
      row.value,
      row.actual_qty,
      (row.site || "").toUpperCase(),
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
      "อ้างอิง",
    ],
    ...rows.map((row) => [
      row.bcode,
      row.descr,
      row.billdate?.slice(0, 10) ?? "",
      row.billno,
      movementKindLabel(row.kind, row.billno),
      (row.site || "").toUpperCase(),
      row.qty,
      row.balance,
      money(row.unit_cost),
      row.cost_billno ?? "",
      money(row.sale_price),
      row.supplier,
      row.ref_billno ?? "",
    ]),
  ];
}

function layerRows(rows: VatInventoryExport["layers"]): (string | number)[][] {
  return [
    ["วันที่", "เอกสาร", "แหล่ง", "สาขา", "ผู้ขาย", "จำนวน", "ทุน/หน่วย"],
    ...rows.map((row) => [
      row.billdate?.slice(0, 10) ?? "",
      row.billno,
      VAT_MOVEMENT_KIND_LABEL[row.source] ?? row.source,
      (row.site || "").toUpperCase(),
      row.supplier,
      row.qty,
      row.unit_cost,
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
  if (data.layers?.length) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(layerRows(data.layers)), "ที่มา");
  }
  if (data.movements.length) {
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet(movementRows(data.movements)),
      "ความเคลื่อนไหว"
    );
  }
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
