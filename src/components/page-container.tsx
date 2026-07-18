import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function PageContainer({
  children,
  className,
}: PageContainerProps): React.JSX.Element {
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-[1344px] p-6 py-6 sm:px-10 lg:px-12",
        className
      )}
    >
      {children}
    </main>
  );
}
