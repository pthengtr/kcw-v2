import { useContext } from "react";
import ExpenseCreateReceiptFormSubmit from "./ExpenseCreateReceiptForm/ExpenseCreateReceiptFormSubmit";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";

export default function ExpenseCreateReceiptSummary() {
  const { createEntries, vatInput, discountInput, withholdingInput } =
    useContext(ExpenseContext) as ExpenseContextType;

  const totalBeforeTax = createEntries.reduce(
    (sum, item) => sum + item.entry_amount,
    0
  );

  const discount = discountInput ? parseFloat(discountInput) : 0;
  const vatOnly = totalBeforeTax * (parseInt(vatInput) / 100);
  const totalAfterTax = totalBeforeTax - discount + vatOnly;
  const withholdingOnly = totalBeforeTax * (parseInt(withholdingInput) / 100);
  const totalNet = totalAfterTax - withholdingOnly;

  return (
    <div className="grid grid-cols-2 gap-2">
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

      <div className="col-span-2 justify-self-center">
        <ExpenseCreateReceiptFormSubmit />
      </div>
    </div>
  );
}
