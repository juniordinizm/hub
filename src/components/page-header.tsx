import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  readonly actions?: ReactNode;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly description?: ReactNode;
  readonly status?: ReactNode;
  readonly title: ReactNode;
}

export function PageHeader({
  actions,
  children,
  className,
  description,
  status,
  title,
}: PageHeaderProps): React.JSX.Element {
  return (
    <header className={cn("flex flex-col gap-4 border-b pb-6", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="type-page-title">{title}</h1>
            {status}
          </div>
          {description ? (
            <p className="type-body-sm max-w-2xl text-muted-foreground sm:text-base">
              {description}
            </p>
          ) : null}
          {children}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
