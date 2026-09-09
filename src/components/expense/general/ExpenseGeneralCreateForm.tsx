"use client";

import * as z from "zod";
import { useContext, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import {
  ExpenseGeneralType,
  ExpenseItemType,
  ExpenseReceiptType,
  UUID,
} from "@/lib/types/models";
import {
  EXPENSE_PERSONAL_OFFSET_ITEM_NAME,
  parseOffsetSummary,
  type ExpenseOffsetSummary,
} from "@/lib/expense/personal-offset";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import ExpensePaymentMethodSelectInput from "../ExpensePaymentMethodSelectInput";
import ExpenseBranchSelectInput from "../ExpenseBranchSelectInput";
import { DatePickerInput } from "@/components/common/DatePickerInput";
import ExpenseSelectItemDialogInput from "../ExpenseSelectItemDialogInput";
import ExpenseGeneralRefReceiptPicker from "./ExpenseGeneralRefReceiptPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export type ExpenseGeneralFormDefaultType = {
  payment_uuid: UUID;
  branch_uuid: UUID;
  item_uuid: UUID;
  entry_date: Date;
  description: string;
  unit_price: number;
  quantity: number;
  remark: string;
  is_offset?: boolean;
  ref_receipt_uuid?: string;
};

export const expenseGeneralFormDefaultValues: ExpenseGeneralFormDefaultType = {
  entry_date: new Date(),
  branch_uuid: "",
  item_uuid: "",
  description: "",
  unit_price: 0,
  quantity: 0,
  payment_uuid: "",
  remark: "",
  is_offset: false,
  ref_receipt_uuid: "",
};

const formSchema = z
  .object({
    is_offset: z.boolean(),
    payment_uuid: z.string(),
    branch_uuid: z.string().nonempty("กรุณาเลือกสาขา"),
    item_uuid: z.string().nonempty("กรุณาเลือกประเภทค่าใช้จ่าย"),
    entry_date: z.coerce.date({
      required_error: "กรุณาระบุวันที่",
      invalid_type_error: "วันที่ไม่ถูกต้อง",
    }),
    description: z.string().nonempty("กรุณาใส่รายละเอียด"),
    unit_price: z.number({ invalid_type_error: "กรุณาใส่ราคาให้ถูกต้อง" }),
    quantity: z.number({ invalid_type_error: "กรุณาใส่จำนวนให้ถูกต้อง" }),
    remark: z.string(),
  })
  .superRefine((val, ctx) => {
    if (val.is_offset) {
      if (!(val.unit_price > 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["unit_price"],
          message:
            val.unit_price < 0
              ? "ใส่เป็นจำนวนบวก ไม่ต้องใส่เครื่องหมายลบ"
              : "กรุณาใส่จำนวนที่หัก",
        });
      }
    } else {
      if (val.unit_price === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["unit_price"],
          message: "กรุณาใส่ราคาให้ถูกต้อง",
        });
      }
      if (val.quantity === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["quantity"],
          message: "กรุณาใส่จำนวนให้ถูกต้อง",
        });
      }
    }
  });

type ExpenseGeneralCreateFormProps = {
  defaultValues: ExpenseGeneralFormDefaultType;
  update?: boolean;
};

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function ExpenseGeneralCreateForm({
  defaultValues,
  update = false,
}: ExpenseGeneralCreateFormProps) {
  const {
    setGeneralEntries,
    selectedGeneralEntry,
    setOpenCreateExpenseGeneralDialog,
    setOpenUpdateExpenseGeneralDialog,
    setSubmitError,
    setTotalGeneralEntries,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    setPaymentMethodFormError,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...expenseGeneralFormDefaultValues,
      ...defaultValues,
      is_offset: Boolean(defaultValues.is_offset),
    },
  });

  const isOffset = form.watch("is_offset");
  const [linkedReceipt, setLinkedReceipt] = useState<
    ExpenseReceiptType | undefined
  >();
  const [receiptError, setReceiptError] = useState<string>("");
  const [offsetItem, setOffsetItem] = useState<ExpenseItemType | null>(null);
  const [offsetSummary, setOffsetSummary] = useState<ExpenseOffsetSummary | null>(
    null
  );

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("expense_item")
      .select("*, expense_category(*)")
      .eq("item_name", EXPENSE_PERSONAL_OFFSET_ITEM_NAME)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setOffsetItem(data as ExpenseItemType);
      });
  }, []);

  useEffect(() => {
    if (isOffset && offsetItem) {
      form.setValue("item_uuid", offsetItem.item_uuid);
    }
  }, [form, isOffset, offsetItem]);

  useEffect(() => {
    const ref = defaultValues.ref_receipt_uuid;
    if (!ref) return;
    const supabase = createClient();
    void supabase
      .from("expense_receipt")
      .select("*, party (*), payment_method (*), branch (*)")
      .eq("receipt_uuid", ref)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setLinkedReceipt(data as ExpenseReceiptType);
      });
  }, [defaultValues.ref_receipt_uuid]);

  useEffect(() => {
    if (!linkedReceipt) {
      setOffsetSummary(null);
      return;
    }
    const supabase = createClient();
    void supabase
      .rpc("fn_expense_receipt_offset_summary", {
        p_receipt: linkedReceipt.receipt_uuid,
        p_exclude: update ? selectedGeneralEntry?.general_uuid ?? null : null,
      })
      .then(({ data, error }) => {
        if (error) {
          console.error(error.message);
          setOffsetSummary(null);
          return;
        }
        setOffsetSummary(parseOffsetSummary(data));
      });
  }, [linkedReceipt, selectedGeneralEntry?.general_uuid, update]);

  function applyLinkedReceipt(rec: ExpenseReceiptType | undefined) {
    setLinkedReceipt(rec);
    setReceiptError("");
    if (!rec) return;
    form.setValue("branch_uuid", rec.branch_uuid);
    form.setValue("entry_date", new Date(rec.receipt_date));
    form.setValue(
      "description",
      `หักส่วนตัวจากบิล ${rec.receipt_number}`
    );
    if (rec.payment_method) {
      setSelectedPaymentMethod(rec.payment_method);
    }
  }

  function enableOffset(next: boolean) {
    form.setValue("is_offset", next);
    if (next) {
      form.setValue("quantity", 1);
      if (offsetItem) form.setValue("item_uuid", offsetItem.item_uuid);
      if (form.getValues("unit_price") < 0) {
        form.setValue("unit_price", Math.abs(form.getValues("unit_price")));
      }
    } else {
      setLinkedReceipt(undefined);
      setOffsetSummary(null);
      setReceiptError("");
    }
  }

  async function persist(values: z.infer<typeof formSchema>) {
    if (!selectedPaymentMethod) {
      setPaymentMethodFormError("กรุณาเลือกวิธีการชำระ");
      return;
    }
    setPaymentMethodFormError(undefined);

    if (values.is_offset) {
      if (!linkedReceipt) {
        setReceiptError("กรุณาเลือกบิลบริษัทที่ต้องการหัก");
        return;
      }
      if (!offsetItem) {
        setSubmitError("ยังไม่มีประเภท หักส่วนตัวจากบิลบริษัท");
        toast.error("ยังไม่มีประเภทหักส่วนตัวในระบบ");
        return;
      }
    }

    const expenseGeneralFormData: Omit<
      ExpenseGeneralType,
      | "general_uuid"
      | "created_at"
      | "payment_method"
      | "branch"
      | "expense_item"
      | "expense_receipt"
    > = {
      payment_uuid: selectedPaymentMethod.payment_uuid,
      branch_uuid: values.branch_uuid,
      item_uuid: values.is_offset && offsetItem ? offsetItem.item_uuid : values.item_uuid,
      entry_date: new Date(values.entry_date).toLocaleString("en-US"),
      description: values.description,
      unit_price: values.is_offset ? -Math.abs(values.unit_price) : values.unit_price,
      quantity: values.is_offset ? 1 : values.quantity,
      remark: values.remark,
      ref_receipt_uuid: values.is_offset ? linkedReceipt?.receipt_uuid ?? null : null,
    };

    const supabase = createClient();
    const query =
      update && selectedGeneralEntry
        ? supabase
            .from("expense_general")
            .update([expenseGeneralFormData])
            .eq("general_uuid", selectedGeneralEntry.general_uuid)
            .select()
        : supabase.from("expense_general").insert([expenseGeneralFormData]).select();

    const { data, error, count } = await query;

    if (error) {
      setSubmitError(error.message);
      toast.error(error.message || "เกิดข้อผิดพลาด ไม่สามารถบันทึกข้อมูลได้");
      return;
    }

    if (data) {
      setSubmitError(undefined);
      toast.success(update ? "แก้ไขข้อมูลสำเร็จ" : "สร้างข้อมูลใหม่สำเร็จ");
      if (update) setGeneralEntries(data);
    }
    if (count !== null && count !== undefined) setTotalGeneralEntries(count);
    setOpenCreateExpenseGeneralDialog(false);
    setOpenUpdateExpenseGeneralDialog(false);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(persist)}
        className="flex flex-col items-stretch justify-center gap-4"
      >
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <div>
            <div className="text-sm font-medium">หักจากบิลบริษัท</div>
            <p className="text-xs text-muted-foreground">
              ส่วนที่เคลม VAT แล้ว แต่บริษัทไม่ได้จ่ายจริง
              ใส่จำนวนที่หักเป็นจำนวนบวก ระบบจะบันทึกเป็นยอดติดลบให้
            </p>
          </div>
          <Switch
            checked={isOffset}
            onCheckedChange={enableOffset}
            aria-label="หักจากบิลบริษัท"
          />
        </div>

        {isOffset ? (
          <div className="space-y-3 rounded-md border border-rose-200 bg-rose-50/60 p-3">
            <div>
              <Label className="mb-1 block">บิลบริษัทที่อ้างอิง</Label>
              <ExpenseGeneralRefReceiptPicker
                value={linkedReceipt}
                onChange={applyLinkedReceipt}
                error={receiptError}
              />
            </div>
            {offsetSummary ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div className="text-muted-foreground">ยอดที่เคลมไว้</div>
                <div className="text-right tabular-nums">
                  {formatBaht(offsetSummary.claimed_opex)}
                </div>
                <div className="text-muted-foreground">หักไปแล้ว</div>
                <div className="text-right tabular-nums text-rose-700">
                  {formatBaht(offsetSummary.already_offset)}
                </div>
                <div className="font-medium">คงเหลือให้หัก</div>
                <div className="text-right tabular-nums font-medium">
                  {formatBaht(offsetSummary.remaining)}
                </div>
              </div>
            ) : null}
            {offsetSummary && offsetSummary.remaining > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  form.setValue("unit_price", offsetSummary.remaining, {
                    shouldValidate: true,
                  })
                }
              >
                หักทั้งบิล
              </Button>
            ) : null}
          </div>
        ) : null}

        <FormField
          control={form.control}
          name="payment_uuid"
          render={() => (
            <FormItem className="w-full">
              <FormLabel>ชำระโดย</FormLabel>
              <FormControl>
                <ExpensePaymentMethodSelectInput />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="branch_uuid"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>สาขา</FormLabel>
              <FormControl>
                <ExpenseBranchSelectInput field={field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isOffset ? (
          <div className="w-full">
            <Label>ประเภทค่าใช้จ่าย</Label>
            <div className="mt-1 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {offsetItem?.item_name ?? EXPENSE_PERSONAL_OFFSET_ITEM_NAME}
            </div>
          </div>
        ) : (
          <FormField
            control={form.control}
            name="item_uuid"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>ประเภทค่าใช้จ่าย</FormLabel>
                <FormControl>
                  <ExpenseSelectItemDialogInput field={field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="entry_date"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>วันที่บิล</FormLabel>
              <FormControl>
                <DatePickerInput field={field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>รายละเอียด</FormLabel>
              <FormControl>
                <Input type="text" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="unit_price"
          render={({ field }) => {
            const amount = Number(form.watch("unit_price"));
            const showOffsetHint = isOffset && Number.isFinite(amount) && amount > 0;
            return (
              <FormItem className="w-full">
                <FormLabel>{isOffset ? "จำนวนที่หัก" : "ราคาต่อหน่วย"}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={isOffset ? 0 : undefined}
                    step="0.01"
                    placeholder={isOffset ? "1070" : undefined}
                    {...field}
                    {...form.register("unit_price", { valueAsNumber: true })}
                  />
                </FormControl>
                {isOffset ? (
                  <FormDescription>
                    ใส่จำนวนบวกเท่านั้น ไม่ต้องใส่เครื่องหมายลบ
                    หักบางส่วนให้พิมพ์ยอดที่ต้องการหัก
                    หักทั้งบิลกดปุ่มด้านบนหรือใส่ยอดคงเหลือ
                    {showOffsetHint
                      ? ` จะบันทึกเป็น -${formatBaht(amount)}`
                      : ""}
                  </FormDescription>
                ) : null}
                <FormMessage />
              </FormItem>
            );
          }}
        />

        {isOffset ? null : (
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>จำนวน</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    {...form.register("quantity", { valueAsNumber: true })}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="remark"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>หมายเหตุ</FormLabel>
              <FormControl>
                <Input type="text" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          disabled={form.formState.isSubmitting}
          className={form.formState.isSubmitting ? "bg-blue-300" : ""}
          type="submit"
        >
          บันทึก
          {form.formState.isSubmitting ? "..." : ""}
        </Button>
      </form>
    </Form>
  );
}
