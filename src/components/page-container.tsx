import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  readonly as?: "div" | "main";
  readonly children: ReactNode;
  readonly className?: string;
}

export function PageContainer({
  as: Component = "div",
  children,
  className,
}: PageContainerProps): React.JSX.Element {
  return (
    <Component
      className={cn(
        "mx-auto w-full max-w-[1344px] p-6 py-6 sm:px-10 lg:px-12",
        className
      )}
    >
      {children}
    </Component>
  );
}
