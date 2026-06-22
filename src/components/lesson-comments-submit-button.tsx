"use client";

import type * as React from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

export function LessonCommentsSubmitButton({
  children,
  pendingLabel = "Enviando...",
  ...props
}: ButtonProps & {
  pendingLabel?: string;
}): React.JSX.Element {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
