"use client";

import { toast } from "sonner";

import * as z from "zod";

import { login } from "@/app/(auth)/action";
import Form from "../common/Form";

const formSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export default function LoginForm() {
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      console.log(values);
      const { email, password } = values;

      const formData = new FormData();
      formData.append("email", email);
      formData.append("password", password);
      login(formData);

      return Promise.resolve({ success: true });
    } catch (error) {
      console.error("Form submission error", error);
      toast.error("Failed to submit the form. Please try again.");
      return Promise.resolve({ success: false });
    }
  }

  return (
    <Form
      schema={formSchema}
      defaultValues={{ email: "", password: "" }}
      onSubmit={onSubmit}
    />
  );
}
