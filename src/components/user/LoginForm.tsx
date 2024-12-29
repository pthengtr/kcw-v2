"use client";

import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { supabase } from "@/lib/supabase";

const formSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export default function LoginForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function signIn(email: string, password: string) {
    // const { data, error } = await supabase.auth.signUp({
    //   email: email,
    //   password: password,
    // });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (!!error) console.log(error);
    if (!!data) console.log(data);

    const { error: signOutError } = await supabase.auth.signOut({
      scope: "others",
    });

    if (!!signOutError) console.log(signOutError);
  }

  function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      console.log(values);
      const { email, password } = values;
      signIn(email, password);
    } catch (error) {
      console.error("Form submission error", error);
      toast.error("Failed to submit the form. Please try again.");
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-8 max-w-3xl mx-auto py-10"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="email" type="" {...field} />
              </FormControl>
              {/* <FormDescription>
                This is your public display name.
              </FormDescription> */}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder="password" {...field} />
              </FormControl>
              {/* <FormDescription>Enter your password.</FormDescription> */}
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit">Login</Button>
      </form>
    </Form>
  );
}
