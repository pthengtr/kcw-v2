"use client";

import { useEffect, useState } from "react";

import DialogPrintButton from "@/components/common/DialogPrintButton";
import {
  formatReceiptMoney,
  formatReceiptQty,
  printedBillNo,
  receiptCompany,
  receiptTitle,
  receiptTotals,
  thaiReceiptDate,
} from "@/lib/vat/generated-bill";
import type { VatRegisterRow } from "@/lib/vat/register";

type ReceiptLine = {
  bcode: string | null;
  detail: string | null;
  qty: number;
  ui: string | null;
  price: number;
  amount: number;
};

type ReceiptBill = {
  billno: string;
  bill_date: string | null;
  lines: ReceiptLine[];
};

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function VatReceiptSheet({ row }: { row: VatRegisterRow }) {
  const [bill, setBill] = useState<ReceiptBill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const credit = row.sheet === "CNTAR" || row.sheet === "3CNTAR";
  const company = receiptCompany(row.sheet);
  const title = receiptTitle(row.sheet);
  const billNo = printedBillNo(row.sheet, bill?.billno || row.bill_no);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      billno: row.bill_no,
      doc_type: row.sheet,
    });
    setLoading(true);
    setError(null);
    void fetch(`/api/sales-bills/detail?${params.toString()}`)
      .then(async (res) => {
        const json = (await res.json()) as {
          billno?: string;
          bill_date?: string | null;
          lines?: Array<Record<string, unknown>>;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || "โหลดบิลไม่สำเร็จ");
        if (cancelled) return;
        setBill({
          billno: String(json.billno ?? row.bill_no),
          bill_date: json.bill_date ?? row.bill_date,
          lines: (json.lines ?? []).map((line) => ({
            bcode: line.bcode ? String(line.bcode) : null,
            detail: line.detail ? String(line.detail) : null,
            qty: num(line.qty),
            ui: line.ui ? String(line.ui) : null,
            price: num(line.price),
            amount: num(line.amount),
          })),
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setBill(null);
        setError(err instanceof Error ? err.message : "โหลดบิลไม่สำเร็จ");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [row.bill_date, row.bill_no, row.sheet]);

  const totals = receiptTotals((bill?.lines ?? []).map((line) => line.amount));

  return (
    <section className="grid gap-3 rounded border border-slate-300 bg-white p-4 text-sm text-slate-900 print:border-0 print:p-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold">{company.name}</p>
          <p>{company.address}</p>
          <p>{company.phone}</p>
          <p className="mt-1">{company.tax}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold">{title}</p>
          <p>
            <span className="font-semibold">เลขที่:</span> {billNo}
          </p>
          <p>
            <span className="font-semibold">วันที่:</span>{" "}
            {thaiReceiptDate(bill?.bill_date || row.bill_date)}
          </p>
          {credit ? (
            <p>
              <span className="font-semibold">อ้างอิง:</span> {row.remark ?? ""}
            </p>
          ) : null}
        </div>
      </div>

      <DialogPrintButton
        disabled={loading || Boolean(error)}
        documentTitle={`${title} ${billNo}`}
      />

      {loading ? (
        <p className="text-slate-500">กำลังโหลดบิล</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <>
          <div className="overflow-auto print:overflow-visible">
            <table className="w-full min-w-[36rem] border-collapse text-sm print:min-w-0">
              <thead>
                <tr>
                  <th className="w-[12%] border border-slate-900 p-1 text-center">รหัสสินค้า</th>
                  <th className="w-[36%] border border-slate-900 p-1 text-center">รายการ</th>
                  <th className="w-[10%] border border-slate-900 p-1 text-center">ราคา/หน่วย</th>
                  <th className="w-[8%] border border-slate-900 p-1 text-center">จำนวน</th>
                  <th className="w-[8%] border border-slate-900 p-1 text-center">หน่วย</th>
                  <th className="w-[13%] border border-slate-900 p-1 text-center">
                    รวมยอดเงิน
                    <br />
                    (รวม VAT)
                  </th>
                </tr>
              </thead>
              <tbody>
                {(bill?.lines ?? []).length === 0 ? (
                  <tr>
                    <td className="border border-slate-900 p-2 text-slate-500" colSpan={6}>
                      ไม่มีรายการ
                    </td>
                  </tr>
                ) : (
                  bill?.lines.map((line, index) => (
                    <tr key={`${line.bcode ?? "line"}-${index}`}>
                      <td className="border border-slate-900 p-1 text-center font-mono">
                        {line.bcode ?? ""}
                      </td>
                      <td className="border border-slate-900 p-1">{line.detail ?? ""}</td>
                      <td className="border border-slate-900 p-1 text-right tabular-nums">
                        {formatReceiptMoney(line.price)}
                      </td>
                      <td className="border border-slate-900 p-1 text-right tabular-nums">
                        {formatReceiptQty(line.qty)}
                      </td>
                      <td className="border border-slate-900 p-1 text-center">{line.ui ?? ""}</td>
                      <td className="border border-slate-900 p-1 text-right tabular-nums">
                        {formatReceiptMoney(line.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-4 text-right">
            <dt className="font-semibold">ยอดก่อน VAT:</dt>
            <dd className="tabular-nums">{formatReceiptMoney(totals.base)}</dd>
            <dt className="font-semibold">VAT 7%:</dt>
            <dd className="tabular-nums">{formatReceiptMoney(totals.vat)}</dd>
            <dt className="font-semibold">รวมทั้งสิ้น (รวม VAT):</dt>
            <dd className="tabular-nums">{formatReceiptMoney(totals.total)}</dd>
          </dl>
        </>
      )}
    </section>
  );
}
