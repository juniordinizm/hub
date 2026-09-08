"use client";

import type React from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

export function FormSubmitButton({
  children,
  loading = false,
  ...props
}: ButtonProps): React.JSX.Element {
  const { pending } = useFormStatus();

  return (
    <Button {...props} loading={pending || loading}>
      {children}
    </Button>
  );
}
