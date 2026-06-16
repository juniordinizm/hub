"use client";

import type { HTMLAttributes, RefObject } from "react";
import { cn } from "@/lib/utils";

const ScrollArea = ({
  className,
  children,
  ref,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  ref?: RefObject<HTMLDivElement | null>;
}) => (
  <div
    className={cn("custom-scrollbar relative overflow-auto", className)}
    ref={ref}
    {...props}
  >
    {children}
  </div>
);
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
