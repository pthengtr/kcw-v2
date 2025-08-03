import { ExpenseReceiptType } from "./summary/ExpenseReceiptColumn";

type ExpenseCommonReceiptSummaryProps = {
  selectedReceipt: ExpenseReceiptType;
};

export default function ExpenseCommonReceiptSummaryDebug({
  selectedReceipt,
}: ExpenseCommonReceiptSummaryProps) {
  const totalBeforeTax = selectedReceipt.total_amount;
  const discount = selectedReceipt.discount;
  const vatOnly = (totalBeforeTax * selectedReceipt.vat) / 100;
  const totalAfterTax = totalBeforeTax - discount + vatOnly;
  const withholdingOnly = (totalBeforeTax * selectedReceipt.withholding) / 100;
  const totalNet = totalAfterTax - withholdingOnly;

  return (
    <>
      <div className="col-span-2 text-center text-sm">
        (for testing purpose)
      </div>
      <div>ราคาก่อนภาษี</div>
      <div className="text-right">
        {totalBeforeTax.toLocaleString("th-TH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>

      <div>ส่วนลด</div>
      <div className="text-right">
        {discount.toLocaleString("th-TH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>

      <div>{`ภาษี ${selectedReceipt.vat} %`}</div>
      <div className="text-right">
        {vatOnly.toLocaleString("th-TH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>

      <div>ราคารวม</div>
      <div className="text-right">
        {totalAfterTax.toLocaleString("th-TH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>

      <div>{`หัก ณ ที่จ่าย ${selectedReceipt.withholding} %`}</div>
      <div className="text-right">
        {withholdingOnly.toLocaleString("th-TH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>

      <div>ราคารวมสุทธิ</div>
      <div className="text-right">
        {totalNet.toLocaleString("th-TH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>
    </>
  );
}
