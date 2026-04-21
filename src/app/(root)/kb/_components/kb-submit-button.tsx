"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

type KbSubmitButtonProps = Omit<ComponentProps<typeof Button>, "children"> & {
  idleText: string;
  pendingText: string;
};

export function KbSubmitButton({
  idleText,
  pendingText,
  disabled,
  ...props
}: KbSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      {...props}
      disabled={disabled || pending}
      aria-disabled={disabled || pending}
    >
      {pending ? pendingText : idleText}
    </Button>
  );
}
