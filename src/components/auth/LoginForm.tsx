"use client";

import * as z from "zod";

import { login } from "@/app/(auth)/action";
import Form from "../common/Form";
import { FieldValues, UseFormReturn } from "react-hook-form";
import { PasswordInput } from "../ui/password-input";
import { Input } from "../ui/input";

const formSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const fieldLabel = { email: "ชื่อบัญชี", password: "รหัสผ่าน" };

function getFieldLabel(field: FieldValues) {
  return fieldLabel[field.name as keyof typeof fieldLabel]
    ? fieldLabel[field.name as keyof typeof fieldLabel]
    : field.name;
}

function getFormInput(
  field: FieldValues,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  form: UseFormReturn<z.infer<typeof formSchema>>
) {
  switch (field.name) {
    //month picker
    case "password":
      return <PasswordInput {...field} />;

    //simple text
    default:
      return <Input type="text" {...field} />;
  }
}

export default function LoginForm() {
  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    const { email, password } = values;

    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);
    await login(formData);
  }

  return (
    <>
      <Form
        className="flex flex-col gap-8"
        schema={formSchema}
        defaultValues={{ email: "", password: "" }}
        onSubmit={onSubmit}
        getFieldLabel={getFieldLabel}
        getFormInput={getFormInput}
        submitLabel="เข้าสู่ระบบ"
      />
    </>
  );
}
