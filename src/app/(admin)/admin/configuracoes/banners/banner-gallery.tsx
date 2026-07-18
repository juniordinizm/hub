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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AlertCircleIcon, CloudUploadIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  ResourceDropzoneEmpty,
  ResourceItemSkeleton,
  ResourceListBody,
  ResourceListContainer,
  ResourceListHeader,
} from "@/components/ui/resource-list";
import {
  deleteBannerAction,
  reorderBannersAction,
  saveBannerAction,
} from "@/features/admin/actions";
import type { AdminBanner } from "@/features/admin/server";
import { BannerCropDialog } from "@/features/banners/banner-crop-dialog";
import {
  BANNER_ACCEPT,
  validateBannerUploadRequest,
} from "@/features/storage/banner-image";
import { cn } from "@/lib/utils";
import { BannerEditModal } from "./banner-edit-modal";
import { readBannerFileSelection } from "./banner-file-selection";
import { SortableBannerItem } from "./sortable-banner-item";

interface BannerGalleryProps {
  initialBanners: AdminBanner[];
}

export function BannerGallery({ initialBanners }: BannerGalleryProps) {
  const router = useRouter();
  const [banners, setBanners] = useState<AdminBanner[]>(initialBanners);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [editingBanner, setEditingBanner] = useState<AdminBanner | null>(null);
  const [autoOpenBannerId, setAutoOpenBannerId] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<
    { id: string; file: File }[]
  >([]);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);

  // Auto-open modal when a new banner finishes uploading and is available in props
  useEffect(() => {
    if (autoOpenBannerId) {
      const found = banners.find((b) => b.id === autoOpenBannerId);
      if (found) {
        setEditingBanner(found);
        setAutoOpenBannerId(null);
      }
    }
  }, [banners, autoOpenBannerId]);

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
        return { error: "O arquivo deve ser uma imagem." };
      }
      if (file.size > maxSize) {
        return { error: "A imagem não pode ter mais de 5MB." };
      }
      if (banners.length >= maxFiles) {
        return { error: "Limite de 5 banners atingido." };
      }

      const toastId = toast.loading("Enviando banner...");
      const tempId = `temp-${Date.now()}`;
      setUploadingFiles((prev) => [...prev, { id: tempId, file }]);

      const formData = new FormData();
      formData.append("imageFile", file);
      formData.append("isActive", "on");

      try {
        const res = await saveBannerAction(formData);

        if (res?.bannerId) {
          const optimisticBanner: AdminBanner = {
            id: res.bannerId,
            imageUrl: URL.createObjectURL(file),
            isActive: true,
            linkUrl: null,
            buttonText: null,
            sortOrder: banners.length + 1,
          };
          setBanners((prev) => [...prev, optimisticBanner]);
        }

        toast.success("Banner enviado com sucesso.", { id: toastId });
        setUploadingFiles((prev) => prev.filter((f) => f.id !== tempId));

        if (res?.bannerId) {
          return { bannerId: res.bannerId };
        }
      } catch (error: unknown) {
        setUploadingFiles((prev) => prev.filter((f) => f.id !== tempId));
        toast.error(
          error instanceof Error ? error.message : "Erro ao enviar banner.",
          { id: toastId }
        );
        return {
          error:
            error instanceof Error ? error.message : "Erro ao enviar banner.",
        };
      }
      return {};
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
      let firstNewBannerId: string | null = null;
      for (const file of filesArray) {
        const result = await uploadFile(file);
        if (typeof result === "object" && result?.error) {
          newErrors.push(`${file.name}: ${result.error}`);
        } else if (
          typeof result === "object" &&
          result?.bannerId &&
          !firstNewBannerId
        ) {
          firstNewBannerId = result.bannerId;
        }
      }

      if (newErrors.length > 0) {
        setErrors(newErrors);
      }

      router.refresh();

      if (firstNewBannerId) {
        setAutoOpenBannerId(firstNewBannerId);
      }
    },
    [banners.length, uploadFile, router]
  );

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleFileSelection = useCallback((files: FileList | File[]) => {
    try {
      const file = readBannerFileSelection(files);
      validateBannerUploadRequest({
        contentType: file.type,
        sizeBytes: file.size,
      });
      setErrors([]);
      setPendingCropFile(file);
    } catch (error: unknown) {
      setErrors([
        error instanceof Error
          ? error.message
          : "Nao foi possivel ler o banner.",
      ]);
    }
  }, []);

  const handleCropComplete = useCallback(
    async (file: File) => {
      setPendingCropFile(null);
      await handleFiles([file]);
    },
    [handleFiles]
  );

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
        handleFileSelection(files);
      }
    },
    [handleFileSelection]
  );

  const removeBanner = (id: string) => {
    const toastId = toast.loading("Removendo...");
    const formData = new FormData();
    formData.append("bannerId", id);
    startTransition(async () => {
      try {
        await deleteBannerAction(formData);
        toast.success("Banner excluído.", { id: toastId });
      } catch {
        toast.error("Erro ao excluir o banner.", { id: toastId });
      }
    });
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <ResourceListContainer
          className={cn(
            isDragging ? "border-primary bg-primary/5" : "",
            (uploadingFiles.length > 0 || isPending) &&
              "pointer-events-none opacity-50"
          )}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={(e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={onDrop}
        >
          <ResourceListHeader
            actions={
              banners.length < maxFiles && (
                <div className="relative">
                  <input
                    accept={BANNER_ACCEPT}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(event) => {
                      const files = event.currentTarget.files;
                      if (files && files.length > 0) {
                        handleFileSelection(files);
                      }
                      event.currentTarget.value = "";
                    }}
                    title="Enviar arquivo"
                    type="file"
                  />
                  <Button
                    className="pointer-events-none h-8 px-3"
                    size="sm"
                    variant="outline"
                  >
                    <HugeiconsIcon
                      aria-hidden="true"
                      className="-ms-0.5 mr-1.5 opacity-60"
                      icon={CloudUploadIcon}
                      size={14}
                    />
                    Adicionar banner
                  </Button>
                </div>
              )
            }
            count={banners.length}
            title="Banners Ativos"
          />

          {banners.length > 0 || uploadingFiles.length > 0 ? (
            <ResourceListBody>
              <DndContext
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                sensors={sensors}
              >
                <SortableContext
                  items={banners}
                  strategy={verticalListSortingStrategy}
                >
                  {banners.map((banner) => (
                    <SortableBannerItem
                      banner={banner}
                      key={banner.id}
                      onDelete={() => removeBanner(banner.id)}
                      onEdit={() => setEditingBanner(banner)}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {uploadingFiles.map((f) => (
                <ResourceItemSkeleton key={f.id} />
              ))}
            </ResourceListBody>
          ) : (
            <ResourceDropzoneEmpty />
          )}
        </ResourceListContainer>
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

      <BannerCropDialog
        file={pendingCropFile}
        onCancel={() => setPendingCropFile(null)}
        onComplete={handleCropComplete}
      />
    </div>
  );
}
