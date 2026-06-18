"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import React, { useEffect, useState, useTransition } from "react";

interface SortableListProps {
  children: React.ReactNode;
  className?: string;
  itemIds: string[];
  onReorder: (newOrder: string[]) => Promise<void> | void;
}

export function SortableList({
  itemIds,
  children,
  onReorder,
  className,
}: SortableListProps) {
  const [items, setItems] = useState(itemIds);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setItems(itemIds);
  }, [itemIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      const newItems = arrayMove(items, oldIndex, newIndex);

      setItems(newItems);
      startTransition(() => {
        onReorder(newItems);
      });
    }
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      id={`dnd-context-${itemIds.join("-").slice(0, 20)}`}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((id) => {
            const childIndex = itemIds.indexOf(id);
            if (childIndex === -1) {
              return null;
            }
            return React.Children.toArray(children)[childIndex];
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

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
        className={`flex cursor-grab items-center justify-center p-2 text-muted-foreground/40 transition-colors hover:text-foreground active:cursor-grabbing group-hover/sortable:text-muted-foreground ${handleClassName || ""}`}
        {...attributes}
        {...listeners}
      >
        <HugeiconsIcon icon={Menu01Icon} size={20} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
