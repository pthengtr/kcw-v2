"use client";

import { DefaultValues, FieldValues, Path, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Form as _Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { DatePickerInput } from "./DatePickerInput";

interface FormProps<T extends FieldValues> {
  schema: z.ZodType<T>;
  defaultValues: T;
  onSubmit: (data: T) => Promise<{ success: boolean }>;
  getFieldLabel: (field: FieldValues) => string;
  className?: string;
  submitLabel?: string;
}

export default function Form<T extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  getFieldLabel,
  className = "",
  submitLabel = "Submit",
}: FormProps<T>) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as DefaultValues<T>,
  });

  //const handleSubmit: SubmitHandler<T> = async () => {};

  function getFormInput(field: FieldValues) {
    switch (field.name) {
      // mask input
      case "password":
        return <PasswordInput {...field} />;
        break;

      // number
      case "bill_count":
      case "total_amount":
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

      //date picker
      case "start_date":
      case "end_date":
      case "due_date":
      case "payment_date":
        return <DatePickerInput field={field} />;
        break;

      //date time picker
      case "kbiz_datetime":
        return <DatePickerInput field={field} timePicker />;
        break;

      //simple text
      default:
        return <Input type="text" {...field} />;
    }
  }

  return (
    <_Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={`max-w-3xl mx-auto ${className}`}
      >
        {Object.keys(defaultValues).map((field) => (
          <FormField
            key={field}
            control={form.control}
            name={field as Path<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{getFieldLabel(field as FieldValues)}</FormLabel>
                <FormControl>{getFormInput(field as FieldValues)}</FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}

        <div className="grid place-content-center w-full">
          <Button disabled={form.formState.isSubmitting} type="submit">
            {submitLabel}
          </Button>
        </div>
      </form>
    </_Form>
  );
}
