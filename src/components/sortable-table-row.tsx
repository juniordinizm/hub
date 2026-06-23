"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface SortableTableRowProps {
  children: React.ReactNode;
  className?: string;
  data?: Record<string, unknown>;
  id: string;
}

export function SortableTableRow({
  id,
  children,
  className,
  data,
}: SortableTableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable(data ? { id, data } : { id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging
      ? {
          position: "relative" as const,
          zIndex: 10,
          backgroundColor: "hsl(var(--muted) / 0.5)",
        }
      : {}),
  };

  return (
    <TableRow
      className={cn(
        "group/sortable transition-colors",
        isDragging && "opacity-95 drop-shadow-xl",
        className
      )}
      ref={setNodeRef}
      style={style}
    >
      <TableCell className="w-[40px] px-2 py-3 text-center align-middle">
        <div
          className="flex cursor-grab items-center justify-center text-muted-foreground/40 transition-colors hover:text-foreground active:cursor-grabbing group-hover/sortable:text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <HugeiconsIcon icon={Menu01Icon} size={20} strokeWidth={2} />
        </div>
      </TableCell>
      {children}
    </TableRow>
  );
}
