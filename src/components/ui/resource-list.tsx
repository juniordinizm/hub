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
        "relative flex min-h-52 flex-col overflow-hidden rounded-xl border border-border border-dashed p-4 transition-colors hover:border-ring/50",
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
  className,
  nodeRef,
  style,
}: {
  children: React.ReactNode;
  isDragging?: boolean;
  className?: string;
  nodeRef?: React.Ref<HTMLDivElement>;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg border bg-background p-2 pe-3 transition-opacity duration-300",
        isDragging && "relative z-50 opacity-50 drop-shadow-md",
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
  attributes: Record<string, unknown> | undefined;
  listeners: Record<string, unknown> | undefined;
  icon: React.ElementType;
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
          className="size-8 text-muted-foreground opacity-50 transition-all hover:bg-destructive/10 hover:text-destructive hover:opacity-100 group-hover:opacity-100"
          size="icon"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
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
  progress: number;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-lg border bg-background p-2 pe-3 transition-opacity duration-300">
      <div className="flex aspect-video w-14 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] sm:w-[72px] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
        <HugeiconsIcon icon={CloudUploadIcon} size={22} strokeWidth={2} />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-col gap-0.5 opacity-60">
          <p className="truncate font-medium text-[13px]">{fileName}</p>
          <p className="truncate text-muted-foreground text-xs">{fileSize}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="w-10 text-muted-foreground text-xs tabular-nums">
            {Math.round(progress)}%
          </span>
        </div>
      </div>
    </div>
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
