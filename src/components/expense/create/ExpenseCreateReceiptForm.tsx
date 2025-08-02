"use client";

import * as z from "zod";

import { FieldValues, UseFormReturn } from "react-hook-form";
import { useContext } from "react";

import { Input } from "@/components/ui/input";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { DatePickerInput } from "@/components/common/DatePickerInput";
import { ExpenseReceiptType } from "../summary/ExpenseReceiptColumn";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { PaymentMethodSelectInput } from "@/components/common/PaymentMethodSelectInput";
import CommonSupplierNameInput from "@/components/common/CommonSupplierNameInput";
import { toast } from "sonner";
import FormExpenseReceipt from "./FormExpenseReceipt";
import { Plus } from "lucide-react";
import VatSelectInput from "@/components/common/VatSelectInput";

export type ExpenseCreateReceiptFormDefaultType = {
  vendor_name: string;
  invoice_number?: string;
  invoice_date?: Date | null;
  tax_invoice_number?: string;
  tax_invoice_date?: Date | null;
  receipt_number?: string;
  receipt_date?: Date | null;
  payment_method: string;
  remark: string;
  vat?: string;
  withholding?: number;
  discount?: number;
};

export const expenseCreateReceiptFormDefaultValues: ExpenseCreateReceiptFormDefaultType =
  {
    vendor_name: "",
    payment_method: "",
    invoice_number: "",
    invoice_date: null,
    tax_invoice_number: "",
    tax_invoice_date: null,
    receipt_number: "",
    receipt_date: null,
    vat: "7",
    withholding: 0,
    discount: 0,
    remark: "",
  };

const expenseCretaeReceiptFormFieldLabel = {
  vendor_name: "ชื่อบริษัท",
  invoice_number: "เลขที่เอกสาร",
  invoice_date: "วันที่เอกสาร",
  tax_invoice_number: "เลขที่ใบกำกับภาษี",
  tax_invoice_date: "วันที่ใบกำกับภาษี",
  receipt_number: "เลขที่ใบเสร็จรับเงิน",
  receipt_date: "วันที่ใบเสร็จรับเงิน",
  payment_method: "ชำระโดย",
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
  form: UseFormReturn<z.infer<typeof formSchema>>
) {
  switch (field.name) {
    case "vat":
      return <VatSelectInput field={field} />;
      break;

    case "withholding":
    case "discount":
      return (
        <Input
          type="number"
          //className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          {...field}
          {...form.register(field.name, {
            valueAsNumber:
              !field.value?.toString() === undefined ? false : true,
          })}
        />
      );
      break;

    case "invoice_date":
    case "tax_invoice_date":
    case "receipt_date":
      return <DatePickerInput field={field} />;
      break;

    case "vendor_name":
      return <CommonSupplierNameInput field={field} />;

    case "payment_method":
      return <PaymentMethodSelectInput field={field} />;
      break;

    //simple text
    default:
      return <Input type="text" {...field} />;
  }
}

const formSchema = z.object({
  vendor_name: z.string().nonempty({ message: "กรุณาใส่ชื่อบริษัท" }),
  invoice_number: z.string().optional(),
  invoice_date: z.union([z.date().nullable().optional(), z.literal("")]),
  tax_invoice_number: z.string().optional(),
  tax_invoice_date: z.union([z.date().nullable().optional(), z.literal("")]),
  receipt_number: z.string().optional(),
  receipt_date: z.union([z.date().nullable().optional(), z.literal("")]),
  payment_method: z.string().nonempty({ message: "กรุณาใส่วิธีการชำระ" }),
  remark: z.string(),
  vat: z.string().optional(),
  discount: z.number().optional(),
  withholding: z.number().optional(),
});

type ExpenseCreateReceiptFormProps = {
  defaultValues: ExpenseCreateReceiptFormDefaultType;
};

export default function ExpenseCreateReceiptForm({
  defaultValues,
}: ExpenseCreateReceiptFormProps) {
  const {
    createEntries,
    setCreateEntries,
    setSubmitError,
    setOpenCreateNoVatReceiptDialog,
    setOpenCreateVatReceiptDialog,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const { branch }: { branch: string } = useParams();

  async function createUpdateSupplier(formData: FormData) {
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

    const formVat = parseFloat(formData.get("vat") as string) as number;
    const formWithholding = parseFloat(
      formData.get("withholding") as string
    ) as number;
    const formDiscount = parseFloat(
      formData.get("discount") as string
    ) as number;

    const createReceiptFormData: ExpenseReceiptType = {
      receipt_id: 0, // dummy value
      vendor_name: formData.get("vendor_name") as string,
      invoice_number: formData.get("invoice_number") as string,
      invoice_date: formData.get("invoice_date") as string,
      tax_invoice_number: formData.get("tax_invoice_number") as string,
      tax_invoice_date: formData.get("tax_invoice_date") as string,
      receipt_number: formData.get("receipt_number") as string,
      receipt_date: formData.get("receipt_date") as string,
      total_amount: createEntries.reduce(
        (sum, item) => sum + item.entry_amount,
        0
      ),
      payment_method: formData.get("payment_method") as string,
      remark: formData.get("remark") as string,
      branch_id: parseInt(branch),
      user_id: user.email,
      vat: formVat ? formVat : 0,
      withholding: formWithholding ? formWithholding : 0,
      discount: formDiscount ? formDiscount : 0,
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
      setCreateEntries([]);
      setOpenCreateNoVatReceiptDialog(false);
      setOpenCreateVatReceiptDialog(false);
      toast.success("สร้างบิลค่าใช้จ่ายใหม่สำเร็จ");
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const {
      vendor_name,
      invoice_number,
      invoice_date,
      tax_invoice_number,
      tax_invoice_date,
      receipt_number,
      receipt_date,
      payment_method,
      remark,
      vat,
      withholding,
      discount,
    } = values;

    const formData = new FormData();

    formData.append("vendor_name", vendor_name);
    formData.append("payment_method", payment_method);
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
    if (vat) {
      formData.append("vat", vat);
    }
    if (withholding) {
      formData.append("withholding", withholding.toString());
    }
    if (discount) {
      formData.append("discount", discount.toString());
    }

    await createUpdateSupplier(formData);
  }

  return (
    <FormExpenseReceipt
      schema={formSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      getFieldLabel={getFieldLabel}
      getFormInput={getFormInput}
      className="grid grid-cols-2 justify-items-center justify-center items-center gap-y-6 gap-x-4"
      submitLabel={
        <>
          <Plus /> สร้างบิล
        </>
      }
    />
  );
}
