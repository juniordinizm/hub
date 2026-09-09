import { HugeiconsIcon } from "@hugeicons/react";
import type React from "react";

export function AdminMetricCard({
  help,
  helper,
  icon: Icon,
  label,
  value,
}: {
  help?: React.ReactNode;
  helper: string;
  // biome-ignore lint/suspicious/noExplicitAny: type from hugeicons
  icon?: any;
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1 rounded-xl border-none bg-card p-4 shadow-sm ring-1 ring-border/50">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-0.5">
          <p className="truncate font-medium text-muted-foreground text-sm tracking-tight">
            {label}
          </p>
          {help}
        </div>
        {Icon && (
          <div className="flex size-7 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
            <HugeiconsIcon
              aria-hidden="true"
              icon={Icon}
              size={16}
              strokeWidth={2}
            />
          </div>
        )}
      </div>
      <div className="mt-2">
        <p className="font-bold text-2xl tabular-nums">{value}</p>
        <p className="mt-1 text-muted-foreground text-xs">{helper}</p>
      </div>
    </div>
  );
}
