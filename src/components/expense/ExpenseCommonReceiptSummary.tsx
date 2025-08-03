import { ExpenseEntryType } from "./summary/ExpenseEntryColumn";

type ExpenseCommonReceiptSummaryProps = {
  entries: ExpenseEntryType[];
  vatInput: number;
  discountInput: number;
  withholdingInput: number;
};

export default function ExpenseCommonReceiptSummary({
  entries,
  vatInput,
  discountInput,
  withholdingInput,
}: ExpenseCommonReceiptSummaryProps) {
  const totalBeforeTax = entries.reduce(
    (sum, item) => sum + item.entry_amount,
    0
  );
  const discount = discountInput ? discountInput : 0;
  const vatOnly = (totalBeforeTax * vatInput) / 100;
  const totalAfterTax = totalBeforeTax - discount + vatOnly;
  const withholdingOnly = (totalBeforeTax * withholdingInput) / 100;
  const totalNet = totalAfterTax - withholdingOnly;

  return (
    <>
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

      <div>{`ภาษี ${vatInput} %`}</div>
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

      <div>{`หัก ณ ที่จ่าย ${withholdingInput} %`}</div>
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
