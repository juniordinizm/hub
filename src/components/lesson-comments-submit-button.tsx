"use client";

import type * as React from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

export function LessonCommentsSubmitButton({
  children,
  ...props
}: ButtonProps): React.JSX.Element {
  const { pending } = useFormStatus();

  return (
    <Button loading={pending} {...props}>
      {children}
    </Button>
  );
}
