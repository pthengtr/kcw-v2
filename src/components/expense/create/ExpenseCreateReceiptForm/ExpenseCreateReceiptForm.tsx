"use client";

import * as z from "zod";

import { FieldValues, UseFormReturn } from "react-hook-form";
import { useContext } from "react";

import { Input } from "@/components/ui/input";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";
import { DatePickerInput } from "@/components/common/DatePickerInput";
import { ExpenseReceiptType } from "../../summary/ExpenseReceiptColumn";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import ExpensePaymentMethodSelectInput from "@/components/expense/create/ExpenseCreateReceiptForm/ExpensePaymentMethodSelectInput";
import { toast } from "sonner";
import FormExpenseReceipt from "./FormExpenseReceipt";
import ExpenseVatSelectInput from "@/components/expense/create/ExpenseCreateReceiptForm/ExpenseVatSelectInput";
import ExpenseWithholdingSelectInput from "./ExpenseWithholdingSelectInput";
import ExpenseDiscountSelectInput from "./ExpenseDiscountInput";
import ExpenseSelectSupplierInput from "./ExpenseSelectSupplierInput";
import { BranchType } from "@/app/(root)/(expense)/expense/page";

export type ExpenseCreateReceiptFormDefaultType = {
  payment_id: string;
  remark: string;
  supplier_id?: string;
  invoice_number?: string;
  invoice_date?: Date | null | undefined | "";
  tax_invoice_number?: string;
  tax_invoice_date?: Date | null | undefined | "";
  receipt_number?: string;
  receipt_date?: Date | null | undefined | "";
  vat?: string | undefined;
  withholding?: string | undefined;
  discount?: string | undefined;
};

export const expenseCreateReceiptFormDefaultValues: ExpenseCreateReceiptFormDefaultType =
  {
    supplier_id: "",
    payment_id: "",
    tax_invoice_number: "",
    tax_invoice_date: null,
    receipt_number: "",
    receipt_date: null,
    invoice_number: "",
    invoice_date: null,
    vat: "7",
    withholding: "0",
    discount: "0",
    remark: "",
  };

const expenseCretaeReceiptFormFieldLabel = {
  supplier_id: "ชื่อบริษัท",
  invoice_number: "เลขที่เอกสาร",
  invoice_date: "วันที่เอกสาร",
  tax_invoice_number: "เลขที่ใบกำกับภาษี",
  tax_invoice_date: "วันที่ใบกำกับภาษี",
  receipt_number: "เลขที่ใบเสร็จรับเงิน",
  receipt_date: "วันที่ใบเสร็จรับเงิน",
  payment_id: "ชำระโดย",
  remark: "หมายเหตุ",
  vat: "ภาษี",
  withholding: "หัก ณ ที่จ่าย",
  discount: "ส่วนลดท้ายบิล",
};

function getFieldLabel(field: FieldValues) {
  return expenseCretaeReceiptFormFieldLabel[
    field.name as keyof typeof expenseCretaeReceiptFormFieldLabel
  ]
    ? expenseCretaeReceiptFormFieldLabel[
        field.name as keyof typeof expenseCretaeReceiptFormFieldLabel
      ]
    : field.name;
}

function getFormInput(
  field: FieldValues,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  form: UseFormReturn<ExpenseCreateReceiptFormDefaultType>
) {
  switch (field.name) {
    case "vat":
      return <ExpenseVatSelectInput />;
      break;

    case "withholding":
      return <ExpenseWithholdingSelectInput />;
      break;

    case "discount":
      return <ExpenseDiscountSelectInput />;
      break;

    case "invoice_date":
    case "tax_invoice_date":
    case "receipt_date":
      return <DatePickerInput field={field} />;
      break;

    case "supplier_id":
      return <ExpenseSelectSupplierInput />;

    case "payment_id":
      return <ExpensePaymentMethodSelectInput />;
      break;

    //simple text
    default:
      return <Input type="text" {...field} />;
  }
}

export const formSchema = z.object({
  invoice_number: z.string().optional(),
  invoice_date: z.union([z.date().nullable().optional(), z.literal("")]),
  tax_invoice_number: z.string().optional(),
  tax_invoice_date: z.union([z.date().nullable().optional(), z.literal("")]),
  receipt_number: z.string().optional(),
  receipt_date: z.union([z.date().nullable().optional(), z.literal("")]),
  payment_id: z.string().nonempty({ message: "กรุณาใส่วิธีการชำระ" }),
  remark: z.string(),
});

type ExpenseCreateReceiptFormProps = {
  defaultValues: ExpenseCreateReceiptFormDefaultType;
};

export default function ExpenseCreateReceiptForm({
  defaultValues,
}: ExpenseCreateReceiptFormProps) {
  const {
    createEntries,
    setSubmitError,
    createReceiptTab,
    vatInput,
    withholdingInput,
    discountInput,
    selectedSupplier,
    selectedPaymentMethod,
    resetCreateReceiptForm,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const { branch }: { branch: string } = useParams();

  async function createUpdateReceipt(formData: FormData) {
    // type-casting here for convenience
    // in practice, you should validate your inputs
    const supabase = createClient();

    const {
      data: { user },
      error: errorUser,
    } = await supabase.auth.getUser();

    if (!user?.email || errorUser) {
      console.log("No user logged in or error:", errorUser);
      return;
    }

    const query = supabase
      .from("branch")
      .select("*")
      .eq("branch_id", branch)
      .limit(500)
      .overrideTypes<BranchType[], { merge: false }>();

    const { data: branches, error: errorBranch } = await query;

    if (errorBranch) {
      console.log("invalid branch", errorUser);
      return;
    }

    const [selectedBranch] = branches;

    const formVat = parseFloat(vatInput);
    const formWithholding = parseFloat(withholdingInput);
    const formDiscount = parseFloat(discountInput);

    if (!selectedSupplier || !selectedPaymentMethod) {
      return;
    }

    const createReceiptFormData: ExpenseReceiptType = {
      invoice_number: formData.get("invoice_number") as string,
      invoice_date: formData.get("invoice_date") as string,
      tax_invoice_number: formData.get("tax_invoice_number") as string,
      tax_invoice_date: formData.get("tax_invoice_date") as string,
      receipt_number: formData.get("receipt_number") as string,
      receipt_date: formData.get("receipt_date") as string,
      remark: formData.get("remark") as string,
      receipt_id: 0, // dummy value
      supplier_id: selectedSupplier.supplier_id,
      supplier: selectedSupplier,
      payment_id: selectedPaymentMethod.payment_id,
      payment_method: selectedPaymentMethod,
      branch_id: parseInt(branch),
      branch: selectedBranch,
      user_id: user.email,
      total_amount: createEntries.reduce(
        (sum, item) => sum + item.entry_amount,
        0
      ),
      discount: formDiscount ? formDiscount : 0,
      vat: formVat ? formVat : 0,
      withholding: formWithholding ? formWithholding : 0,
      submit_to_account: createReceiptTab === "company" ? true : false,
    };

    console.log(JSON.stringify(createReceiptFormData));
    console.log(JSON.stringify(createEntries));

    const rpcFunction = "fn_create_new_expense_receipt";

    const { data: dataRpc, error: errorRpc } = await supabase.rpc(rpcFunction, {
      new_receipt: JSON.stringify(createReceiptFormData),
      new_receipt_entries: JSON.stringify(createEntries),
    });

    if (errorRpc) {
      setSubmitError(errorRpc.message);
      toast.error(errorRpc.message);
      return;
    }
    if (dataRpc) {
      resetCreateReceiptForm();
      toast.success("สร้างบิลค่าใช้จ่ายใหม่สำเร็จ");
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const {
      invoice_number,
      invoice_date,
      tax_invoice_number,
      tax_invoice_date,
      receipt_number,
      receipt_date,
      payment_id,
      remark,
    } = values;

    const formData = new FormData();

    formData.append("payment_id", payment_id);
    formData.append("remark", remark);

    if (invoice_number) {
      formData.append("invoice_number", invoice_number);
    }
    if (invoice_date) {
      formData.append("invoice_date", invoice_date.toLocaleString("en-US"));
    }
    if (tax_invoice_number) {
      formData.append("tax_invoice_number", tax_invoice_number);
    }
    if (tax_invoice_date) {
      formData.append(
        "tax_invoice_date",
        tax_invoice_date.toLocaleString("en-US")
      );
    }
    if (receipt_number) {
      formData.append("receipt_number", receipt_number);
    }
    if (receipt_date) {
      formData.append("receipt_date", receipt_date.toLocaleString("en-US"));
    }

    await createUpdateReceipt(formData);
  }

  return (
    <>
      <FormExpenseReceipt
        defaultValues={defaultValues}
        onSubmit={onSubmit}
        getFieldLabel={getFieldLabel}
        getFormInput={getFormInput}
        className="grid grid-cols-2 justify-items-center justify-center items-start gap-y-6 gap-x-4"
      />
    </>
  );
}
