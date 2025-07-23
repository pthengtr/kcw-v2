"use client";

import {
  DefaultValues,
  FieldValues,
  Path,
  useForm,
  UseFormReturn,
} from "react-hook-form";
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

interface FormProps<T extends FieldValues> {
  schema: z.ZodType<T>;
  defaultValues: T;
  onSubmit: (data: T) => void;
  getFieldLabel: (field: FieldValues) => string;
  getFormInput: (
    field: FieldValues,
    form: UseFormReturn<T, undefined>
  ) => React.ReactNode;
  className?: string;
  submitLabel?: string | React.ReactNode;
}

export default function Form<T extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  getFieldLabel,
  getFormInput,
  className = "",
  submitLabel = "Submit",
}: FormProps<T>) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as DefaultValues<T>,
  });

  return (
    <_Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={`mx-auto ${className}`}
      >
        {Object.keys(defaultValues).map((field) => (
          <FormField
            key={field}
            control={form.control}
            name={field as Path<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{getFieldLabel(field as FieldValues)}</FormLabel>
                <FormControl>
                  {getFormInput(field as FieldValues, form)}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}

        <div className="self-center">
          <Button
            disabled={form.formState.isSubmitting}
            className={`${form.formState.isSubmitting && "bg-blue-300"}`}
            type="submit"
          >
            {submitLabel}
            {form.formState.isSubmitting ? "..." : ""}
          </Button>
        </div>
      </form>
    </_Form>
  );
}
