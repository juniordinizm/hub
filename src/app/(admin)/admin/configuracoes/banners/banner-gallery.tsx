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
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  AlertCircleIcon,
  CloudUploadIcon,
  Loading02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  deleteBannerAction,
  reorderBannersAction,
  saveBannerAction,
} from "@/features/admin/actions";
import type { AdminBanner } from "@/features/admin/server";
import { cn } from "@/lib/utils";
import { BannerEditModal } from "./banner-edit-modal";
import { SortableBannerItem } from "./sortable-banner-item";

interface BannerGalleryProps {
  initialBanners: AdminBanner[];
}

export function BannerGallery({ initialBanners }: BannerGalleryProps) {
  const [banners, setBanners] = useState<AdminBanner[]>(initialBanners);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [editingBanner, setEditingBanner] = useState<AdminBanner | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setBanners(initialBanners);
  }, [initialBanners]);

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

  const maxFiles = 5;
  const maxSize = 5 * 1024 * 1024; // 5MB

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setBanners((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);

        startTransition(async () => {
          try {
            await reorderBannersAction(newOrder.map((b) => b.id));
            toast.success("Ordem dos banners atualizada.");
          } catch {
            toast.error("Erro ao reordenar banners.");
          }
        });

        return newOrder;
      });
    }
  };

  const uploadFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        return "O arquivo deve ser uma imagem.";
      }
      if (file.size > maxSize) {
        return "A imagem não pode ter mais de 5MB.";
      }
      if (banners.length >= maxFiles) {
        return "Limite de 5 banners atingido.";
      }

      setIsUploading(true);
      const formData = new FormData();
      formData.append("imageFile", file);
      formData.append("isActive", "on");

      try {
        await saveBannerAction(formData);
        toast.success("Banner enviado com sucesso.");
      } catch (error: unknown) {
        return error instanceof Error
          ? error.message
          : "Erro ao enviar banner.";
      } finally {
        setIsUploading(false);
      }
      return null;
    },
    [banners.length]
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const newErrors: string[] = [];
      const filesArray = Array.from(files);

      if (banners.length + filesArray.length > maxFiles) {
        setErrors(["Você só pode adicionar até 5 banners no total."]);
        return;
      }

      setErrors([]);
      for (const file of filesArray) {
        const error = await uploadFile(file);
        if (error) {
          newErrors.push(`${file.name}: ${error}`);
        }
      }

      if (newErrors.length > 0) {
        setErrors(newErrors);
      }
    },
    [banners.length, uploadFile]
  );

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFiles(files);
      }
    },
    [handleFiles]
  );

  const openFileDialog = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*";
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files) {
        handleFiles(target.files);
      }
    };
    input.click();
  }, [handleFiles]);

  const removeBanner = (id: string) => {
    // biome-ignore lint/suspicious/noAlert: Simple confirmation
    if (confirm("Tem certeza que deseja excluir este banner?")) {
      const formData = new FormData();
      formData.append("bannerId", id);
      startTransition(async () => {
        try {
          await deleteBannerAction(formData);
          toast.success("Banner excluído.");
        } catch {
          toast.error("Erro ao excluir o banner.");
        }
      });
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <SortableContext items={banners} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {banners.map((banner) => (
                <SortableBannerItem
                  banner={banner}
                  key={banner.id}
                  onDelete={() => removeBanner(banner.id)}
                  onEdit={() => setEditingBanner(banner)}
                />
              ))}

              {banners.length < maxFiles && (
                <Card
                  className={cn(
                    "relative flex aspect-video flex-col items-center justify-center rounded-lg border-2 border-dashed shadow-none transition-colors",
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50",
                    (isUploading || isPending) &&
                      "pointer-events-none opacity-50"
                  )}
                  onDragEnter={onDragEnter}
                  onDragLeave={onDragLeave}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={onDrop}
                >
                  <CardContent className="flex flex-col items-center p-6 text-center">
                    <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
                      {isUploading || isPending ? (
                        <HugeiconsIcon
                          className="size-5 animate-spin text-muted-foreground"
                          icon={Loading02Icon}
                          strokeWidth={2}
                        />
                      ) : (
                        <HugeiconsIcon
                          className="size-5 text-muted-foreground"
                          icon={CloudUploadIcon}
                          strokeWidth={2}
                        />
                      )}
                    </div>
                    <h3 className="mb-1 font-medium text-sm">
                      Adicionar Banner
                    </h3>
                    <span className="mb-4 block text-muted-foreground text-xs">
                      Arraste ou clique (Máx 5MB)
                    </span>
                    <Button
                      disabled={isUploading || isPending}
                      onClick={openFileDialog}
                      size="sm"
                      variant="secondary"
                    >
                      Selecionar arquivo
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {errors.length > 0 && (
        <Alert className="mt-5" variant="destructive">
          <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
          <AlertTitle>Erro ao enviar arquivo(s)</AlertTitle>
          <AlertDescription>
            {errors.map((error) => (
              <p className="last:mb-0" key={error}>
                {error}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {editingBanner && (
        <BannerEditModal
          banner={editingBanner}
          onClose={() => setEditingBanner(null)}
          open={!!editingBanner}
        />
      )}
    </div>
  );
}
