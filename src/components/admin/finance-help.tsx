"use client";

import { HelpCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function FinanceHelp({
  className,
  description,
  details = [],
  title,
}: {
  className?: string;
  description: string;
  details?: string[];
  title: string;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={250}>
      <Dialog onOpenChange={setOpen} open={open}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-label={`Ajuda: ${title}`}
                className={cn(
                  "relative min-h-0 min-w-0 shrink-0 touch-manipulation rounded-full after:absolute after:-inset-1 after:rounded-full after:content-['']",
                  className
                )}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={HelpCircleIcon}
                  size={18}
                  strokeWidth={2}
                />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs whitespace-normal" sideOffset={6}>
            Ver explicação sobre {title}
          </TooltipContent>
        </Tooltip>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajuda: {title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {details.length ? (
            <DialogBody className="overscroll-contain">
              <ul className="grid gap-3 text-sm">
                {details.map((detail) => (
                  <li className="flex gap-2" key={detail}>
                    <span
                      aria-hidden="true"
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground"
                    />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </DialogBody>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Entendi
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
