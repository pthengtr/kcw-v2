"use client";

import * as z from "zod";

import { FieldValues, UseFormReturn } from "react-hook-form";
import { useContext } from "react";

import { Input } from "@/components/ui/input";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";
import { DatePickerInput } from "@/components/common/DatePickerInput";
import { createClient } from "@/lib/supabase/client";
import { useParams, usePathname, useRouter } from "next/navigation";
import ExpensePaymentMethodSelectInput from "@/components/expense/ExpensePaymentMethodSelectInput";
import { toast } from "sonner";
import FormExpenseReceipt from "./FormExpenseReceipt";
import ExpenseVatSelectInput from "@/components/expense/create/ExpenseCreateReceiptForm/ExpenseVatSelectInput";
import ExpenseWithholdingSelectInput from "./ExpenseWithholdingSelectInput";
import ExpenseDiscountSelectInput from "./ExpenseDiscountInput";
import ExpenseSelectSupplierInput from "./ExpenseSelectSupplierInput";
import { BranchType, ExpenseReceiptType } from "@/lib/types/models";
import ExpenseReceiptNumberInput from "./ExpenseReceiptNumberInput";
import ExpenseTaxExemptInput from "./ExpenseTaxExemptInput";
import RefReceiptByNumber from "./RefReceiptByNumber";
import { uploadReceiptFiles } from "@/lib/utils";

export type ExpenseCreateReceiptFormDefaultType = {
  payment_uuid: string;
  remark: string;
  supplier_uuid?: string;
  receipt_number: string;
  receipt_date: Date;
  vat: string;
  withholding: string;
  discount: string;
  // tax_exempt: string;
};

export type ExpenseCreateCreditNoteFormDefaultType = {
  payment_uuid: string;
  remark: string;
  ref_number?: string;
  receipt_number: string;
  receipt_date: Date;
  vat: string;
  withholding: string;
  discount: string;
  // tax_exempt: string;
};

export const expenseCreateReceiptFormDefaultValues: ExpenseCreateReceiptFormDefaultType =
  {
    supplier_uuid: "",
    payment_uuid: "",
    receipt_number: "",
    receipt_date: new Date(),
    vat: "7",
    withholding: "0",
    discount: "0",
    // tax_exempt: "0",
    remark: "",
  };

export const expenseCreateCreditNoteFormDefaultValues: ExpenseCreateCreditNoteFormDefaultType =
  {
    ref_number: "",
    payment_uuid: "",
    receipt_number: "",
    receipt_date: new Date(),
    vat: "7",
    withholding: "0",
    discount: "0",
    // tax_exempt: "0",
    remark: "",
  };

const expenseCretaeReceiptFormFieldLabel = {
  supplier_uuid: "ชื่อบริษัท",
  receipt_number: "เลขที่เอกสาร",
  receipt_date: "วันที่",
  payment_uuid: "ชำระโดย",
  remark: "หมายเหตุ",
  vat: "ภาษี",
  withholding: "หัก ณ ที่จ่าย",
  discount: "ส่วนลดท้ายบิล",
  tax_exempt: "ยกเว้นภาษี",
  ref_number: "อ้างอิงเอกสาร",
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
    case "ref_number":
      return <RefReceiptByNumber />;
      break;

    case "vat":
      return <ExpenseVatSelectInput />;
      break;

    case "withholding":
      return <ExpenseWithholdingSelectInput />;
      break;

    case "discount":
      return <ExpenseDiscountSelectInput />;
      break;

    case "tax_exempt":
      return <ExpenseTaxExemptInput />;
      break;

    case "invoice_date":
    case "tax_invoice_date":
    case "receipt_date":
      return <DatePickerInput field={field} />;
      break;

    case "supplier_uuid":
      return <ExpenseSelectSupplierInput />;

    case "payment_uuid":
      return <ExpensePaymentMethodSelectInput />;
      break;

    case "receipt_number":
      return <ExpenseReceiptNumberInput />;

    //simple text
    default:
      return <Input type="text" {...field} />;
  }
}

export const formSchema = z.object({
  ref_number: z.string().optional(),
  payment_uuid: z.string(),
  supplier_uuid: z.string().optional(),
  receipt_number: z.string(),
  vat: z.string(),
  withholding: z.string(),
  discount: z.string(),
  receipt_date: z.coerce.date({
    required_error: "กรุณาระบุวันที่",
    invalid_type_error: "วันที่ไม่ถูกต้อง",
  }),
  // tax_exempt: z.string(),
  remark: z.string(),
});

type ExpenseCreateReceiptFormProps = {
  defaultValues:
    | ExpenseCreateReceiptFormDefaultType
    | ExpenseCreateCreditNoteFormDefaultType;
  update?: boolean;
};

export default function ExpenseCreateReceiptForm({
  defaultValues,
  update = false,
}: ExpenseCreateReceiptFormProps) {
  const {
    createEntries,
    vatInput,
    withholdingInput,
    discountInput,
    selectedSupplier,
    selectedPaymentMethod,
    selectedReceipt,
    deleteEntries,
    setPaymentMethodFormError,
    setSupplierFormError,
    setReceiptNameFormError,
    receiptNumber,
    taxExemptInput,
    selectedRefReceipt,
    pendingFiles,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const { branch }: { branch: string } = useParams();

  const router = useRouter();

  const pathName = usePathname();

  async function createReceipt(formData: FormData) {
    // type-casting here for convenience
    // in practice, you should validate your inputs
    const supabase = createClient();

    const {
      data: { user },
      error: errorUser,
    } = await supabase.auth.getUser();

    if (!user?.email || errorUser) {
      toast.error(errorUser ? errorUser.message : "ไม่พบบัญชีผู้ใช้");
      console.log(errorUser ? errorUser.message : "ไม่พบบัญชีผู้ใช้");
      return;
    }

    const query = supabase
      .from("branch")
      .select("*")
      .eq("branch_uuid", branch)
      .limit(500)
      .overrideTypes<BranchType[], { merge: false }>();

    const { data: branches, error: errorBranch } = await query;

    if (errorBranch) {
      console.log(errorBranch.message);
      toast.error(errorBranch.message);
      return;
    }

    const [selectedBranch] = branches;

    const formVat = parseFloat(vatInput);
    const formWithholding = parseFloat(withholdingInput);
    const formDiscount = parseFloat(discountInput);
    const formTaxExempt = parseFloat(taxExemptInput);

    if (!receiptNumber) {
      console.log("ไม่พบข้อมูลเลขที่เอกสาร");
      setReceiptNameFormError("กรูณากรอกเลขที่เอกสาร");
      toast.error("ไม่พบข้อมูลเลขที่เอกสาร");
    } else {
      setReceiptNameFormError(undefined);
    }

    if (!selectedSupplier) {
      console.log("ไม่พบข้อมูลชื่อบริษัท");
      setSupplierFormError("กรูณาเลือกบริษัท");
      toast.error("ไม่พบข้อมูลชื่อบริษัท");
    } else {
      setSupplierFormError(undefined);
    }

    if (!selectedPaymentMethod) {
      console.log("ไม่พบข้อมูลวิธีการชำระ");
      setPaymentMethodFormError("กรุณาเลือกวิธีการชำระ");
      toast.error("ไม่พบข้อมูลวิธีการชำระ");
    } else {
      setPaymentMethodFormError(undefined);
    }

    if (!selectedSupplier || !selectedSupplier || !selectedPaymentMethod)
      return;

    const createReceiptFormData: Omit<ExpenseReceiptType, "doc_type"> = {
      receipt_number: receiptNumber,
      receipt_date: formData.get("receipt_date") as string,
      remark: formData.get("remark") as string,
      receipt_uuid: "", // dummy value
      party_uuid: selectedSupplier?.party_uuid,
      supplier: selectedSupplier,
      payment_uuid: selectedPaymentMethod.payment_uuid,
      payment_method: selectedPaymentMethod,
      branch_uuid: branch,
      branch: selectedBranch,
      user_id: user.email,
      total_amount: createEntries.reduce(
        (sum, item) => sum + item.entry_amount,
        0
      ),
      tax_exempt: formTaxExempt ? formTaxExempt : 0,
      discount: formDiscount ? formDiscount : 0,
      vat: formVat ? formVat : 0,
      withholding: formWithholding ? formWithholding : 0,
      created_at: "", // dummy value
      voucher_description: createEntries.reduce((prev, current) =>
        current.entry_amount > prev.entry_amount ? current : prev
      ).entry_detail,
      ...(pathName.includes("credit-note") || selectedRefReceipt
        ? {
            doc_type: "CREDIT_NOTE",
            ref_receipt_uuid: selectedRefReceipt?.receipt_uuid,
          }
        : {}),
    };

    // console.log(selectedReceipt?.receipt_uuid);
    // console.log(JSON.stringify(createReceiptFormData));
    // console.log(JSON.stringify(createEntries));
    // console.log(JSON.stringify(deleteEntries));

    const rpcFunction = update
      ? "fn_update_expense_receipt"
      : "fn_create_new_expense_receipt";

    const input = update
      ? {
          receipt_uuid_input: selectedReceipt?.receipt_uuid,
          updated_receipt: JSON.stringify(createReceiptFormData),
          updated_entries: JSON.stringify(createEntries),
          deleted_entry_uuids: JSON.stringify(deleteEntries),
        }
      : {
          new_receipt: JSON.stringify(createReceiptFormData),
          new_receipt_entries: JSON.stringify(createEntries),
        };

    const { data: dataRpc, error: errorRpc } = await supabase.rpc(
      rpcFunction,
      input
    );

    if (errorRpc) {
      toast.error(errorRpc.message);
      return;
    }
    console.log(dataRpc);
    if (dataRpc) {
      uploadReceiptFiles(
        update ? selectedReceipt?.receipt_uuid : dataRpc,
        pendingFiles
      );

      toast.success(
        `${update ? "แก้ไข" : "สร้าง"}${
          pathName.includes("credit-note") || selectedRefReceipt
            ? "ใบลดหนี้"
            : "บิลค่าใช้จ่าย"
        }สำเร็จ`
      );
      router.back();
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const { receipt_date, remark } = values;

    const formData = new FormData();

    formData.append("remark", remark);

    if (receipt_date) {
      formData.append("receipt_date", receipt_date.toLocaleString("en-US"));
    }

    await createReceipt(formData);
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
