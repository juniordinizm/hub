"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SortableItemProps {
  ariaLabel: string;
  children: React.ReactNode;
  className?: string;
  data?: Record<string, unknown>;
  disabled?: boolean;
  handleClassName?: string;
  handleHidden?: boolean;
  id: string;
}

export function SortableItem({
  ariaLabel,
  id,
  children,
  className,
  handleClassName,
  data,
  disabled = false,
  handleHidden = false,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable(data ? { data, disabled, id } : { disabled, id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { position: "relative" as const, zIndex: 10 } : {}),
  };

  return (
    <div
      className={cn(
        "group/sortable flex items-stretch transition-colors",
        isDragging && "opacity-95 drop-shadow-xl",
        className
      )}
      ref={setNodeRef}
      style={style}
    >
      {handleHidden ? null : (
        <Button
          aria-label={ariaLabel}
          className={cn(
            "size-11 touch-manipulation self-center text-muted-foreground/50 hover:text-foreground active:cursor-grabbing md:size-10",
            !disabled && "cursor-grab",
            handleClassName
          )}
          disabled={disabled}
          size="icon"
          type="button"
          variant="ghost"
          {...attributes}
          {...listeners}
        >
          <HugeiconsIcon icon={Menu01Icon} size={20} strokeWidth={2} />
        </Button>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
