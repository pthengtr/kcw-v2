"use client";

import * as z from "zod";
import { v4 as uuidv4 } from "uuid";

import Form from "@/components/common/Form";
import { FieldValues, UseFormReturn } from "react-hook-form";
import { useContext } from "react";

import { Input } from "@/components/ui/input";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { VAT } from "@/lib/utils";

import { Plus } from "lucide-react";
import { ExpenseEntryType, UUID } from "@/lib/types/models";
import ExpenseSelectItemDialogInput from "../../ExpenseSelectItemDialogInput";

export type ExpenseAddEntryFormDefaultType = {
  entry_detail: string;
  unit_price: number;
  quantity: number;
  discount?: number;
  item_uuid: string;
  includeVat?: boolean;
};

export const expenseAddEntryFormDefaultValues: ExpenseAddEntryFormDefaultType =
  {
    item_uuid: "",
    entry_detail: "",
    unit_price: 0,
    includeVat: false,
    quantity: 0,
    discount: 0,
  };

const expenseAddEntryFormFieldLabel = {
  item_uuid: " ",
  entry_detail: "รายละเอียด",
  unit_price: "ราคาต่อหน่วย",
  quantity: "จำนวน",
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
    case "item_uuid":
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
  discount: z.number().optional(),
  item_uuid: z.string().nonempty({ message: "กรุณาเลือกประเภทค่าใข้จ่าย" }),
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

    const formItemUuid = formData.get("item_uuid") as UUID;

    const formExpenseItem = expenseItems.find(
      (item) => item.item_uuid === formItemUuid
    );

    if (!formExpenseItem) return;

    let formUnitPrice = parseFloat(
      formData.get("unit_price") as string
    ) as number;

    if ((formData.get("includeVat") as string) === "true") {
      formUnitPrice = (formUnitPrice * 100) / (100 + VAT);
    }

    const discountForm = parseFloat(
      formData.get("discount") as string
    ) as number;

    const expenseAddEntryFormData: ExpenseEntryType = {
      entry_uuid:
        update && selectedEntry ? selectedEntry?.entry_uuid : uuidv4(),
      receipt_uuid: "", // dummy value
      item_uuid: formItemUuid,
      entry_detail: formData.get("entry_detail") as string,
      unit_price: formUnitPrice,
      quantity: parseFloat(formData.get("quantity") as string) as number,
      entry_amount: 0, // to be calculate later
      expense_item: formExpenseItem,
      discount: discountForm ? discountForm : 0,
    };

    expenseAddEntryFormData.entry_amount =
      (expenseAddEntryFormData.unit_price - expenseAddEntryFormData.discount) *
      expenseAddEntryFormData.quantity;

    const newCreateEntries: ExpenseEntryType[] = update
      ? [
          ...createEntries.filter(
            (item) => item.entry_uuid !== selectedEntry?.entry_uuid
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
      item_uuid,
      discount,
      includeVat,
    } = values;

    const formData = new FormData();

    formData.append("entry_detail", entry_detail);
    formData.append("unit_price", unit_price.toString());
    formData.append("quantity", quantity.toString());
    if (discount) {
      formData.append("discount", discount.toString());
    }
    if (item_uuid) {
      formData.append("item_uuid", item_uuid);
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
