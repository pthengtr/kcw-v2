"use client";

import {
  FieldValues,
  Path,
  SubmitHandler,
  UseFormReturn,
} from "react-hook-form";

import {
  Form as _Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";
import { ExpenseCreateReceiptFormDefaultType } from "./ExpenseCreateReceiptForm";

interface FormProps<T extends FieldValues> {
  defaultValues: T;
  onSubmit: SubmitHandler<ExpenseCreateReceiptFormDefaultType>;
  getFieldLabel: (field: FieldValues) => string;
  getFormInput: (
    field: FieldValues,
    form: UseFormReturn<ExpenseCreateReceiptFormDefaultType>
  ) => React.ReactNode;
  className?: string;
}

export default function FormExpenseReceipt<T extends FieldValues>({
  defaultValues,
  onSubmit,
  getFieldLabel,
  getFormInput,
  className = "",
}: FormProps<T>) {
  const { formExpenseReceipt: form, selectedPaymentMethod } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  const needsVoucher =
    !!selectedPaymentMethod && selectedPaymentMethod.voucher_type !== "skip";

  const fieldNames = Object.keys(defaultValues).filter(
    (name) => name !== "payment_date" || needsVoucher
  );

  return (
    <_Form {...form}>
      <form
        id="create-expense-receipt-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className={`mx-auto ${className}`}
      >
        {fieldNames.map((name) => (
          <FormField
            key={name}
            control={form.control}
            name={name as Path<ExpenseCreateReceiptFormDefaultType>}
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>{getFieldLabel(field as FieldValues)}</FormLabel>
                <FormControl>
                  {getFormInput(field as FieldValues, form)}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
      </form>
    </_Form>
  );
}
