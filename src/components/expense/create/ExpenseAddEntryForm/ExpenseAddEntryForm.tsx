"use client";

import * as z from "zod";

import Form from "@/components/common/Form";
import { FieldValues, UseFormReturn } from "react-hook-form";
import { useContext } from "react";

import { Input } from "@/components/ui/input";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";
import { ExpenseEntryType } from "../../summary/ExpenseEntryColumn";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { VAT } from "@/lib/utils";
import ExpenseSelectItemDialogInput from "./ExpenseSelectItemDialogInput";
import { Plus } from "lucide-react";

export type ExpenseAddEntryFormDefaultType = {
  entry_detail: string;
  unit_price: number;
  quantity: number;
  discount: number;
  item_id: string;
  includeVat?: boolean;
};

export const expenseAddEntryFormDefaultValues: ExpenseAddEntryFormDefaultType =
  {
    item_id: "",
    entry_detail: "",
    unit_price: 0,
    includeVat: false,
    quantity: 0,
    discount: 0,
  };

const expenseAddEntryFormFieldLabel = {
  entry_detail: "รายละเอียด",
  unit_price: "ราคาต่อหน่วย",
  quantity: "จำนวน",
  item_id: " ",
  includeVat: " ",
  discount: "ส่วนลดต่อรายการ",
};

function getFieldLabel(field: FieldValues) {
  return expenseAddEntryFormFieldLabel[
    field.name as keyof typeof expenseAddEntryFormFieldLabel
  ]
    ? expenseAddEntryFormFieldLabel[
        field.name as keyof typeof expenseAddEntryFormFieldLabel
      ]
    : field.name;
}

function getFormInput(
  field: FieldValues,
  form: UseFormReturn<z.infer<typeof formSchema>>
) {
  switch (field.name) {
    case "item_id":
      return <ExpenseSelectItemDialogInput field={field} />;

    case "includeVat":
      return (
        <Label className="flex gap-4 items-center just">
          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
          <span>ราคาต่อหน่วยรวมภาษีแล้ว</span>
        </Label>
      );

    case "discount":
    case "unit_price":
    case "quantity":
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
    //simple text
    default:
      return <Input type="text" {...field} />;
  }
}

const formSchema = z.object({
  entry_detail: z
    .string()
    .nonempty({ message: "กรุณาใส่รายละเอียดค่าใช้จ่าย" }),
  unit_price: z.number().refine((val) => val !== 0, {
    message: "กรุณาใส่ราคาให้ถูกต้อง",
  }),
  quantity: z.number().refine((val) => val !== 0, {
    message: "กรุณาใส่จำนวนให้ถูกต้อง",
  }),
  //item_id: z.string().nonempty({ message: "กรุณาเลือกประเุภทค่าใช้จ่าย" }),
  discount: z.number(),
  item_id: z.string().nonempty({ message: "กรุณาเลือกประเภทค่าใข้จ่าย" }),
  includeVat: z.boolean().optional(),
});

type ExpenseAddEntryFormProps = {
  defaultValues: ExpenseAddEntryFormDefaultType;
  update?: boolean;
};

export default function ExpenseAddEntryForm({
  defaultValues,
  update = false,
}: ExpenseAddEntryFormProps) {
  const {
    setOpenAddEntryDialog,
    setOpenUpdateEntryDialog,
    //selectedItem,
    selectedEntry,
    createEntries,
    setCreateEntries,
    expenseItems,
  } = useContext(ExpenseContext) as ExpenseContextType;

  async function createUpdateSupplier(formData: FormData) {
    // type-casting here for convenience
    // in practice, you should validate your inputs

    // if (!selectedItem) {
    //   setOpenAddEntryDialog(false);
    //   setOpenUpdateEntryDialog(false);
    //   return;
    // }

    const formItemId = parseInt(formData.get("item_id") as string) as number;

    console.log(formItemId, expenseItems);
    const formExpenseItem = expenseItems.find(
      (item) => item.item_id === formItemId
    );

    if (!formExpenseItem) return;

    let formUnitPrice = parseFloat(
      formData.get("unit_price") as string
    ) as number;

    if ((formData.get("includeVat") as string) === "true") {
      formUnitPrice = (formUnitPrice * 100) / (100 + VAT);
    }

    const expenseAddEntryFormData: ExpenseEntryType = {
      entry_id:
        update && selectedEntry
          ? selectedEntry.entry_id
          : createEntries.length + 1,
      receipt_id: 0, // dummy value
      item_id: formItemId,
      entry_detail: formData.get("entry_detail") as string,
      unit_price: formUnitPrice,
      quantity: parseFloat(formData.get("quantity") as string) as number,
      entry_amount: 0, // to be calculate later
      expense_item: formExpenseItem,
      discount: parseFloat(formData.get("discount") as string) as number,
    };

    expenseAddEntryFormData.entry_amount =
      (expenseAddEntryFormData.unit_price - expenseAddEntryFormData.discount) *
      expenseAddEntryFormData.quantity;

    const newCreateEntries = update
      ? [
          ...createEntries.filter(
            (item) => item.entry_id !== selectedEntry?.entry_id
          ),
          expenseAddEntryFormData,
        ]
      : [...createEntries, expenseAddEntryFormData];

    setCreateEntries(newCreateEntries);
    setOpenAddEntryDialog(false);
    setOpenUpdateEntryDialog(false);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const {
      entry_detail,
      unit_price,
      quantity,
      item_id,
      discount,
      includeVat,
    } = values;

    const formData = new FormData();

    formData.append("entry_detail", entry_detail);
    formData.append("unit_price", unit_price.toString());
    formData.append("quantity", quantity.toString());
    formData.append("discount", discount.toString());
    if (item_id) {
      formData.append("item_id", item_id);
    }
    if (includeVat) {
      formData.append("includeVat", includeVat.toString());
    }

    await createUpdateSupplier(formData);
  }
  return (
    <Form
      schema={formSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      getFieldLabel={getFieldLabel}
      getFormInput={getFormInput}
      className="flex flex-col justify-center items-center gap-6"
      submitLabel={
        <>
          <Plus /> เพิ่มรายการในบิลนี้
        </>
      }
    />
  );
}
