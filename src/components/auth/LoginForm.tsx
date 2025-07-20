"use client";

import * as z from "zod";

import { login } from "@/app/(auth)/action";
import Form from "../common/Form";
import { FieldValues } from "react-hook-form";

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
        submitLabel="เข้าสู่ระบบ"
      />
    </>
  );
}
