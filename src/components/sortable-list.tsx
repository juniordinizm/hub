"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type React from "react";

interface SortableItemProps {
  children: React.ReactNode;
  className?: string;
  data?: Record<string, unknown>;
  handleClassName?: string;
  id: string;
}

export function SortableItem({
  id,
  children,
  className,
  handleClassName,
  data,
}: SortableItemProps) {
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
    ...(isDragging ? { position: "relative" as const, zIndex: 10 } : {}),
  };

  return (
    <div
      className={`group/sortable flex items-stretch transition-colors ${
        isDragging ? "opacity-95 drop-shadow-xl" : ""
      } ${className || ""}`}
      ref={setNodeRef}
      style={style}
    >
      <div
        className={`flex cursor-grab justify-center p-2 text-muted-foreground/40 transition-colors hover:text-foreground active:cursor-grabbing group-hover/sortable:text-muted-foreground ${handleClassName ?? "items-center"}`}
        {...attributes}
        {...listeners}
      >
        <HugeiconsIcon icon={Menu01Icon} size={20} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
