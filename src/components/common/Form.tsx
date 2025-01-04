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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

interface FormProps<T extends FieldValues> {
  schema: z.ZodType<T>;
  defaultValues: T;
  onSubmit: (data: T) => Promise<{ success: boolean }>;
}

export default function Form<T extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
}: FormProps<T>) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as DefaultValues<T>,
  });

  //const handleSubmit: SubmitHandler<T> = async () => {};

  return (
    <_Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-8 max-w-3xl mx-auto py-10"
      >
        {Object.keys(defaultValues).map((field) => (
          <FormField
            key={field}
            control={form.control}
            name={field as Path<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{field.name}</FormLabel>
                <FormControl>
                  {field.name === "password" ? (
                    <PasswordInput {...field} />
                  ) : (
                    <Input type="text" {...field} />
                  )}
                </FormControl>
              </FormItem>
            )}
          />
        ))}

        <div className="grid place-content-center w-full">
          <Button disabled={form.formState.isSubmitting} type="submit">
            Submit
          </Button>
        </div>
      </form>
    </_Form>
  );
}
