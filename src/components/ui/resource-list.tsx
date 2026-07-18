"use client";

import {
  CloudUploadIcon,
  Delete02Icon,
  FileImageIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ResourceListContainerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function ResourceListContainer({
  children,
  className,
  ...props
}: ResourceListContainerProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border border-border border-dashed p-4 transition-colors hover:border-ring/50",
        className
      )}
      {...props}
    >
      <div className="flex w-full flex-col gap-4">{children}</div>
    </div>
  );
}

export function ResourceListHeader({
  title,
  count,
  actions,
}: {
  title: string;
  count?: number;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="truncate font-medium text-sm">
        {title} {typeof count === "number" && `(${count})`}
      </h3>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function ResourceListBody({ children }: { children: React.ReactNode }) {
  return <div className="w-full space-y-2">{children}</div>;
}

export function ResourceItem({
  children,
  isDragging,
  nodeRef,
  style,
  className,
}: {
  children: React.ReactNode;
  isDragging?: boolean;
  nodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative flex min-w-0 items-center gap-2 overflow-hidden rounded-lg border bg-background p-1.5 pe-3 transition-colors",
        isDragging && "z-50 opacity-50 shadow-md ring-1 ring-ring",
        className
      )}
      ref={nodeRef}
      style={style}
    >
      {children}
    </div>
  );
}

export function ResourceItemDragHandle({
  attributes,
  listeners,
  icon: Icon,
}: {
  // biome-ignore lint/suspicious/noExplicitAny: dnd-kit typings
  attributes: any;
  // biome-ignore lint/suspicious/noExplicitAny: dnd-kit typings
  listeners: any;
  // biome-ignore lint/suspicious/noExplicitAny: icon typings
  icon: any;
}) {
  return (
    <div
      className="cursor-grab p-1 text-muted-foreground opacity-50 transition-opacity hover:text-foreground active:cursor-grabbing group-hover:opacity-100"
      {...attributes}
      {...listeners}
    >
      <HugeiconsIcon icon={Icon} size={20} strokeWidth={2} />
    </div>
  );
}

export function ResourceItemVisual({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-[40px] w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30 sm:w-[72px]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ResourceItemContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-1", className)}>
      {children}
    </div>
  );
}

export function ResourceItemActions({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex shrink-0 items-center gap-1">{children}</div>;
}

export function ResourceDeleteAction({
  onDelete,
  title = "Remover anexo",
  description = "Tem certeza que deseja remover este anexo? Esta ação não pode ser desfeita.",
}: {
  onDelete: () => void;
  title?: string;
  description?: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          aria-label="Remover"
          className="size-8 text-muted-foreground opacity-50 hover:bg-destructive/10 hover:text-destructive hover:opacity-100 group-hover:opacity-100"
          size="icon"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <HugeiconsIcon icon={Delete02Icon} />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete}>Remover</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ResourceUploadProgressItem({
  fileName,
  fileSize,
  progress,
}: {
  fileName: string;
  fileSize: string;
  progress?: number;
}) {
  return (
    <ResourceItem className="transition-opacity duration-300">
      <div
        aria-hidden="true"
        className="flex w-8 shrink-0 items-center justify-center opacity-0"
      >
        {/* Placeholder invisible for alignment */}
      </div>

      <ResourceItemVisual className="bg-muted/50 text-muted-foreground">
        <HugeiconsIcon
          className="animate-pulse"
          icon={CloudUploadIcon}
          size={22}
          strokeWidth={2}
        />
      </ResourceItemVisual>

      <ResourceItemContent className="opacity-60">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 truncate font-medium text-[13px]">
            {fileName}
          </p>
          <span className="shrink-0 rounded-md px-1.5 py-0.5 font-semibold text-[10px] text-muted-foreground uppercase tracking-normal">
            {typeof progress === "number"
              ? `${Math.round(progress)}%`
              : "Enviando"}
          </span>
        </div>
        <p className="truncate text-muted-foreground text-xs">{fileSize}</p>
      </ResourceItemContent>

      {typeof progress === "number" ? (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-muted/50">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-0 h-1 animate-pulse bg-primary/60" />
      )}
    </ResourceItem>
  );
}

export function ResourceDropzoneEmpty() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center px-4 py-8 text-center">
      <div
        aria-hidden="true"
        className="mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border bg-background"
      >
        <HugeiconsIcon className="opacity-60" icon={FileImageIcon} size={18} />
      </div>
      <p className="mb-1.5 font-medium text-sm">Arraste seus arquivos aqui</p>
      <p className="text-muted-foreground text-xs">Suporta diversos formatos</p>
    </div>
  );
}
