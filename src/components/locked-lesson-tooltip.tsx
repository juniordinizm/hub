"use client";

import { ArrowRightIcon, SquareLock02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function LockedNavigationCard({
  label,
  title,
}: {
  label: string;
  title: string;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div
      aria-disabled="true"
      className="flex w-full min-w-0 select-none flex-col items-end rounded-xl border border-border bg-muted/30 p-3 text-right text-muted-foreground opacity-75 sm:p-4"
    >
      <span className="flex max-w-full items-center gap-1.5 text-muted-foreground text-xs">
        <span className="truncate">{label}</span>
        <HugeiconsIcon
          className="shrink-0"
          icon={ArrowRightIcon}
          size={14}
          strokeWidth={2}
        />
      </span>
      <span className="mt-1 flex max-w-full items-center gap-1.5 font-semibold text-muted-foreground text-sm">
        <TooltipProvider delayDuration={200}>
          <Tooltip onOpenChange={setOpen} open={open}>
            <TooltipTrigger asChild>
              <button
                aria-label="Aula bloqueada"
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted-foreground/15 text-muted-foreground transition-colors hover:bg-muted-foreground/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen((prev) => !prev);
                }}
                type="button"
              >
                <HugeiconsIcon
                  icon={SquareLock02Icon}
                  size={12}
                  strokeWidth={2}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Conclua esta aula para liberar a próxima.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="truncate">{title}</span>
      </span>
    </div>
  );
}
