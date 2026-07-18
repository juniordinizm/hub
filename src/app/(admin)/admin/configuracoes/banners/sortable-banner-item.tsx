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
        <p className="truncate font-medium text-[13px]">
          {banner.linkUrl ? banner.linkUrl : "Sem link configurado"}
        </p>
        <div className="flex items-center gap-2">
          <span
            className={`font-semibold text-[11px] uppercase tracking-wide ${
              banner.isActive
                ? "text-green-600 dark:text-green-500"
                : "text-muted-foreground"
            }`}
          >
            {banner.isActive ? "Ativo" : "Inativo"}
          </span>
          {banner.buttonText && (
            <span className="truncate text-muted-foreground text-xs">
              &bull; Botão: {banner.buttonText}
            </span>
          )}
        </div>
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
