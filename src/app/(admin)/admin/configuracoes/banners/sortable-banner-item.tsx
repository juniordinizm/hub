"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DragDropVerticalIcon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  ResourceDeleteAction,
  ResourceItem,
  ResourceItemActions,
  ResourceItemContent,
  ResourceItemDragHandle,
  ResourceItemVisual,
} from "@/components/ui/resource-list";
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
  };

  return (
    <ResourceItem isDragging={isDragging} nodeRef={setNodeRef} style={style}>
      <ResourceItemDragHandle
        attributes={attributes}
        icon={DragDropVerticalIcon}
        listeners={listeners}
      />

      <ResourceItemVisual
        className={`aspect-[21/9] w-24 sm:w-32 ${
          banner.isActive ? "" : "opacity-50 grayscale"
        }`}
      >
        <Image
          alt="Banner preview"
          className="pointer-events-none object-cover"
          fill
          src={`/api/banners/${banner.id}/image`}
          unoptimized
        />
      </ResourceItemVisual>

      <ResourceItemContent>
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 truncate font-medium text-[13px]">
            {banner.linkUrl ? banner.linkUrl : "Sem link configurado"}
          </p>
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 font-semibold text-[10px] uppercase tracking-normal ${
              banner.isActive
                ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400"
                : "bg-muted/80 text-muted-foreground"
            }`}
          >
            {banner.isActive ? "Ativo" : "Inativo"}
          </span>
        </div>
        <p className="truncate text-muted-foreground text-xs">
          {banner.buttonText ? `Botão: ${banner.buttonText}` : "Sem botão"}
        </p>
      </ResourceItemContent>

      <ResourceItemActions>
        <Button
          aria-label="Editar banner"
          className="size-8 text-muted-foreground transition-colors hover:text-foreground"
          onClick={onEdit}
          size="icon"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon icon={PencilEdit01Icon} size={16} strokeWidth={2} />
        </Button>
        <ResourceDeleteAction
          description="Tem certeza que deseja excluir este banner permanentemente?"
          onDelete={onDelete}
          title="Excluir banner"
        />
      </ResourceItemActions>
    </ResourceItem>
  );
}
