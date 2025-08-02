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
  const { formExpenseReceipt: form } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  return (
    <_Form {...form}>
      <form
        id="create-expense-receipt-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className={`mx-auto ${className}`}
      >
        {Object.keys(defaultValues).map((field) => (
          <FormField
            key={field}
            control={form.control}
            name={field as Path<ExpenseCreateReceiptFormDefaultType>}
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
