import React, { Ref, useContext } from "react";
import Image from "next/image";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { ExtendedExpenseReceiptType } from "@/lib/types/models";
import { Separator } from "@/components/ui/separator";
import { numberToThaiWords } from "@/lib/utils";

type ExpenseVoucherA4Props = {
  printRef: Ref<HTMLDivElement> | undefined;
  extendedVouchers: ExtendedExpenseReceiptType[];
};

export default function ExpenseVoucherA4({
  printRef,
  extendedVouchers,
}: ExpenseVoucherA4Props) {
  const { selectedVoucher } = useContext(ExpenseContext) as ExpenseContextType;

  const selectedExtendedVoucher = extendedVouchers.find(
    (voucher) => voucher.receipt_uuid === selectedVoucher?.receipt_uuid
  );

  if (!selectedExtendedVoucher) {
    return (
      <div className="grid place-content-center">กรุณาเลือกใบสำคัญรับก่อน</div>
    );
  }

  const groupVouchers = extendedVouchers.filter(
    (voucher) => voucher.voucherId === selectedExtendedVoucher.voucherId
  );

  const vouchersTotalAmount = groupVouchers.reduce(
    (acc, item) => acc + item.total_amount - item.discount,
    0
  );
  const vouchersVat = groupVouchers.reduce(
    (acc, item) =>
      acc +
      (item.total_amount - item.discount - item.tax_exempt) * (item.vat / 100),
    0
  );
  const vouchersWithholding = groupVouchers.reduce(
    (acc, item) =>
      acc +
      (item.total_amount - item.discount - item.tax_exempt) *
        (item.withholding / 100),
    0
  );
  const vouchersTotalNet =
    vouchersTotalAmount + vouchersVat - vouchersWithholding;

  return (
    <div
      ref={printRef}
      className="bg-white w-[210mm] min-h-[297mm] mx-auto border border-black p-8 text-sm leading-tight text-black font-prompt"
    >
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex gap-4 items-center">
            <div>
              <Image
                src="/kcw-logo.png"
                alt="KCW Logo"
                width={120} // Adjust size as needed
                height={120}
                className="mb-2"
                priority
              />
            </div>
            <div className="flex flex-col gap-2">
              <div>บริษัท เกียรติชัยอะไหล่ยนต์ 2007 จำกัด (สำนักงานใหญ่)</div>
              <div>ที่อยู่ 305 ม.1 ต.ชุมแสง อ.วังจันทร์ จ.ระยอง 21210</div>
              <div>โทร. 038-666-078</div>
              <div className="mt-3">เลขประจำตัวผู้เสียภาษี 0215560000262</div>
            </div>
          </div>
          <div className="p-6 bg-slate-100 flex flex-col gap-4 items-center">
            <div className="text-2xl">ใบสำคัญจ่าย</div>
            <div className="grid grid-cols-2 gap-y-2">
              <div>เลขที่</div>
              <div className="text-right">
                {selectedExtendedVoucher.voucherId}
              </div>
              <div>วันที่</div>
              <div className="text-right">
                {new Date(
                  groupVouchers.at(-1)?.receipt_date as string
                ).toLocaleDateString("th-TH", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>
        </div>
        <Separator />
        {/* Payment to */}
        <div className="grid grid-cols-[1fr,auto] w-fit">
          <div className="pr-4">จ่ายให้</div>
          <div>{selectedExtendedVoucher.supplier.party_name}</div>
          <div className="pr-4">โดย</div>
          <div>
            {selectedExtendedVoucher.payment_method.payment_description}
          </div>
        </div>
        <Separator />
        {/* List */}
        <div className="grid grid-cols-[1fr,1fr,1fr,1fr,1fr] text-xs">
          <>
            <div className="bg-slate-100 p-2 mb-2 w-32">เลขที่เอกสาร</div>
            <div className="bg-slate-100 p-2 mb-2 w-80">รายละเอียด</div>
            <div className="bg-slate-100 p-2 mb-2 w-full">ภาษี</div>
            <div className="bg-slate-100 p-2 mb-2 w-full min-w-24">
              หัก ณ ที่จ่าย
            </div>
            <div className="bg-slate-100 p-2 mb-2 w-18">จำนวนเงิน</div>
            {groupVouchers.map((voucher) => (
              <React.Fragment key={voucher.receipt_uuid}>
                <div className="p-1">{voucher.receipt_number}</div>
                <div className="p-1">{voucher.voucher_description}</div>
                <div className="text-right p-1">
                  {(
                    ((voucher.total_amount -
                      voucher.discount -
                      voucher.tax_exempt) *
                      voucher.vat) /
                    100
                  ).toLocaleString("th-TH", {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2,
                  })}
                </div>

                <div className="text-right p-1">
                  {(
                    ((voucher.total_amount -
                      voucher.discount -
                      voucher.tax_exempt) *
                      voucher.withholding) /
                    100
                  ).toLocaleString("th-TH", {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2,
                  })}
                </div>

                <div className="text-right p-1">
                  {voucher.totalNet.toLocaleString("th-TH", {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2,
                  })}
                </div>
              </React.Fragment>
            ))}
          </>
        </div>
        <Separator />
        {/* Summary */}
        <div className="flex items-center justify-between ">
          <div className="grid grid-cols-[auto,1fr] gap-y-2 gap-x-4">
            <div>มูลค่าก่อนภาษี</div>
            <div className="text-right">
              {vouchersTotalAmount.toLocaleString("th-TH", {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2,
              })}
            </div>
            <div>ภาษีมูลค่าเพิ่ม 7%</div>
            <div className="text-right">
              {vouchersVat.toLocaleString("th-TH", {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2,
              })}
            </div>
            <div>จำนวนเงินที่ถูกหัก ณ ที่จ่าย</div>
            <div className="text-right">
              {vouchersWithholding.toLocaleString("th-TH", {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2,
              })}
            </div>
          </div>
          <div className="bg-slate-100 p-6 flex flex-col items-center gap-4">
            <div className=" flex gap-4 items-center">
              <div className="text-lg">จำนวนเงินทั้งสิ้น</div>
              <div className="text-xl font-bold tracking-wide">
                {vouchersTotalNet.toLocaleString("th-TH", {
                  maximumFractionDigits: 2,
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div className="text-xs">{`(${numberToThaiWords(
              vouchersTotalNet
            )})`}</div>
          </div>
        </div>
        <Separator />
        {/* Footer */}
        <div className="flex justify-between py-8 px-8">
          <div className="mt-8 px-8 py-2 border-t">ผู้อนุมัติจ่าย</div>
          <div className="mt-8 px-8 py-2 border-t">ผู้จ่ายเงิน</div>
          <div className="mt-8 px-8 py-2 border-t">ผู้รับเงิน</div>
        </div>

        <div className="flex flex-col gap-4">
          <div>หมายเหตุ</div>
          <div className="grid grid-cols-3 w-fit">
            {groupVouchers.map((voucher) => (
              <React.Fragment key={voucher.receipt_uuid}>
                {voucher.remark && (
                  <>
                    <div>{`remark-${voucher.receipt_number}`}</div>
                    <div className="col-span-2">{voucher.remark}</div>
                  </>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
