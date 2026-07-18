"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DragDropVerticalIcon,
  MultiplicationSignIcon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import type { AdminBanner } from "@/features/admin/server";

interface SortableBannerItemProps {
  banner: AdminBanner;
  onDelete: () => void;
  onEdit: () => void;
}

export function SortableBannerItem({
  banner,
  onEdit,
  onDelete,
}: SortableBannerItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: banner.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 50, position: "relative" as const } : {}),
  };

  return (
    <div
      className={`group/item relative flex aspect-video shrink-0 items-center justify-center rounded-lg border bg-accent/50 shadow-none transition-all duration-200 hover:z-10 hover:bg-accent/70 ${
        isDragging ? "opacity-80 drop-shadow-xl" : ""
      }`}
      ref={setNodeRef}
      style={style}
    >
      <div className="absolute inset-0 overflow-hidden rounded-lg">
        <Image
          alt="Banner preview"
          className="pointer-events-none object-cover"
          fill
          src={`/api/banners/${banner.id}/image`}
          unoptimized
        />
      </div>

      {!banner.isActive && (
        <div className="absolute inset-0 z-10 rounded-lg bg-background/50 backdrop-blur-[2px]" />
      )}

      {/* Drag Handle */}
      <div
        className="absolute start-2 top-2 z-20 cursor-grab opacity-0 active:cursor-grabbing group-hover/item:opacity-100"
        {...attributes}
        {...listeners}
      >
        <Button
          className="size-7 rounded-full shadow-sm dark:bg-zinc-800 hover:dark:bg-zinc-700"
          size="icon"
          type="button"
          variant="outline"
        >
          <HugeiconsIcon
            className="size-4"
            icon={DragDropVerticalIcon}
            strokeWidth={2}
          />
        </Button>
      </div>

      {/* Remove Button Overlay */}
      <Button
        className="absolute end-2 top-2 z-20 size-7 rounded-full opacity-0 shadow-sm transition-opacity group-hover/item:opacity-100 dark:bg-zinc-800 hover:dark:bg-zinc-700"
        onClick={onDelete}
        size="icon"
        type="button"
        variant="outline"
      >
        <HugeiconsIcon
          className="size-4"
          icon={MultiplicationSignIcon}
          strokeWidth={2}
        />
      </Button>

      {/* File Info & Edit overlay */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between rounded-b-lg bg-black/70 p-2 text-white opacity-0 transition-opacity group-hover/item:opacity-100">
        <div className="flex flex-col truncate">
          <p className="truncate font-medium text-xs">
            {banner.buttonText
              ? `Link: ${banner.linkUrl}`
              : "Sem link configurado"}
          </p>
          <p className="text-gray-300 text-xs">
            {banner.isActive ? "Ativo na página" : "Inativo"}
          </p>
        </div>
        <Button
          className="size-7 shrink-0 text-white hover:bg-white/20 hover:text-white"
          onClick={onEdit}
          size="icon"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon className="size-4" icon={PencilEdit01Icon} />
        </Button>
      </div>
    </div>
  );
}
