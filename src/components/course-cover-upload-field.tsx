"use client";

import { Cancel01Icon, ImageUpload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CourseCoverCropDialog } from "@/features/courses/course-cover-crop-dialog";
import {
  COURSE_COVER_ACCEPT,
  COURSE_COVER_CARD_HEIGHT,
  COURSE_COVER_CARD_WIDTH,
  parseCourseCoverImage,
} from "@/features/storage/course-cover";
import { uploadStagedAdminImage } from "@/features/storage/staged-image-upload-client";
import { cn } from "@/lib/utils";

interface CourseCoverUploadFieldProps {
  aggregateId: string;
  className?: string;
  defaultCoverImage?: unknown;
  defaultThumbnailUrl?: string | null | undefined;
}

const MAX_COVER_BYTES = 4 * 1024 * 1024;
const ALLOWED_COVER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const isValidCoverFile = (file: File): boolean => {
  if (!ALLOWED_COVER_TYPES.has(file.type)) {
    toast.error("Por favor, envie uma imagem JPG, PNG ou WebP.");
    return false;
  }

  if (file.size > MAX_COVER_BYTES) {
    toast.error("A imagem deve ter no máximo 4 MB.");
    return false;
  }

  return true;
};

export function CourseCoverUploadField({
  aggregateId,
  className,
  defaultCoverImage,
  defaultThumbnailUrl,
}: CourseCoverUploadFieldProps): React.JSX.Element {
  const parsedCover = parseCourseCoverImage(defaultCoverImage);
  const inputId = `course-cover-upload-${aggregateId}`;
  const [coverImageJson, setCoverImageJson] = useState(() =>
    parsedCover ? JSON.stringify(parsedCover) : ""
  );
  const [coverUploadJson, setCoverUploadJson] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(defaultThumbnailUrl ?? "");
  const [previewBlurDataUrl, setPreviewBlurDataUrl] = useState(
    parsedCover?.blurDataUrl ?? null
  );
  const [isPreviewLoaded, setIsPreviewLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const uploadRequestIdRef = useRef(0);

  useEffect(
    () => () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    },
    []
  );

  const setLocalPreview = (file: File): boolean => {
    if (!isValidCoverFile(file)) {
      if (inputRef.current) {
        inputRef.current.value = "";
      }

      return false;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    objectUrlRef.current = nextPreviewUrl;
    setPreviewBlurDataUrl(null);
    setIsPreviewLoaded(false);
    setPreviewUrl(nextPreviewUrl);
    return true;
  };

  const clearSelectedFile = (): void => {
    uploadRequestIdRef.current += 1;
    setIsUploading(false);
    setPendingCropFile(null);
    setCoverUploadJson("");
    setPreviewBlurDataUrl(null);
    setIsPreviewLoaded(false);
    setPreviewUrl("");

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const restorePersistedPreview = (): void => {
    setPendingCropFile(null);
    setCoverUploadJson("");
    setPreviewBlurDataUrl(parsedCover?.blurDataUrl ?? null);
    setIsPreviewLoaded(false);
    setPreviewUrl(defaultThumbnailUrl ?? "");

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const stageFile = async (file: File): Promise<void> => {
    if (!setLocalPreview(file)) {
      return;
    }

    const requestId = uploadRequestIdRef.current + 1;
    uploadRequestIdRef.current = requestId;
    setCoverUploadJson("");
    setIsUploading(true);
    try {
      const reference = await uploadStagedAdminImage({
        aggregateId,
        file,
        purpose: "course-cover",
      });
      if (uploadRequestIdRef.current !== requestId) {
        return;
      }
      setCoverUploadJson(JSON.stringify(reference));
      toast.success("Capa enviada. Salve o curso para aplicar.");
    } catch (error) {
      if (uploadRequestIdRef.current !== requestId) {
        return;
      }
      restorePersistedPreview();
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a capa."
      );
    } finally {
      if (uploadRequestIdRef.current === requestId) {
        setIsUploading(false);
      }
    }
  };

  const assignDroppedFile = (file: File): void => {
    if (!(inputRef.current && isValidCoverFile(file))) {
      return;
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    inputRef.current.files = dataTransfer.files;
    setPendingCropFile(file);
  };

  const cancelCrop = (): void => {
    setPendingCropFile(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const completeCrop = (file: File): void => {
    setPendingCropFile(null);
    stageFile(file).catch(() => undefined);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) {
      assignDroppedFile(file);
    } else if (file) {
      toast.error("Por favor, envie um arquivo de imagem válido.");
    }
  };

  const removeFile = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCoverImageJson("");
    clearSelectedFile();
  };

  return (
    <div className={cn("flex w-full flex-col gap-2 sm:w-[280px]", className)}>
      <input name="coverImage" type="hidden" value={coverImageJson} />
      <input name="coverUpload" type="hidden" value={coverUploadJson} />
      <input
        name="coverUploadPending"
        type="hidden"
        value={isUploading ? "on" : ""}
      />

      <div className="relative aspect-[24/25] w-full">
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Drag-and-drop supplements the labelled file input. */}
        <label
          className={cn(
            "group relative flex h-full w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed transition-[border-color,background-color] duration-200 ease-out focus-within:border-ring focus-within:outline-none focus-within:ring-[3px] focus-within:ring-ring/50",
            isDragging ? "border-ring bg-muted" : "border-input hover:bg-muted",
            previewUrl ? "border-transparent border-solid" : ""
          )}
          htmlFor={inputId}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            accept={COURSE_COVER_ACCEPT}
            aria-label="Selecionar capa do Curso"
            className="sr-only"
            id={inputId}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];

              if (file) {
                if (isValidCoverFile(file)) {
                  setPendingCropFile(file);
                } else {
                  event.currentTarget.value = "";
                }
              }
            }}
            ref={inputRef}
            type="file"
          />

          {previewUrl ? (
            <>
              {isPreviewLoaded ? null : (
                <div
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-0 bg-muted",
                    previewBlurDataUrl
                      ? "scale-105 bg-center bg-cover blur-sm"
                      : "animate-pulse"
                  )}
                  style={
                    previewBlurDataUrl
                      ? { backgroundImage: `url(${previewBlurDataUrl})` }
                      : undefined
                  }
                />
              )}
              {/* biome-ignore lint/performance/noImgElement: preview may be a blob URL, not optimizable by next/image */}
              {/* biome-ignore lint/correctness/useImageSize: image fills container via CSS */}
              {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: onLoad only controls the non-interactive visual placeholder */}
              <img
                alt="Capa do curso"
                className={cn(
                  "absolute inset-0 size-full object-cover transition-opacity duration-200",
                  isPreviewLoaded ? "opacity-100" : "opacity-0"
                )}
                onLoad={() => setIsPreviewLoaded(true)}
                src={previewUrl}
              />
              <div className="pointer-events-none absolute inset-0 rounded-xl border border-foreground/10" />

              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 opacity-0 backdrop-blur-sm transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-visible:opacity-100">
                <p className="font-medium text-sm">
                  Clique para alterar a capa
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-4 text-center">
              <div className="mb-2 flex size-10 shrink-0 items-center justify-center rounded-full border bg-background">
                <HugeiconsIcon
                  aria-hidden="true"
                  className="text-muted-foreground opacity-60"
                  icon={ImageUpload01Icon}
                  size={18}
                />
              </div>
              <p className="mb-1 font-medium text-sm leading-snug">
                Arraste ou clique para selecionar a capa
              </p>
              <p className="text-muted-foreground text-xs">
                Card: {COURSE_COVER_CARD_WIDTH} × {COURSE_COVER_CARD_HEIGHT} px
                (24:25) · PNG, JPG ou WebP até 4 MB
              </p>
            </div>
          )}
        </label>

        {previewUrl && (
          <div className="absolute top-3 right-3 z-50">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    aria-label="Remover imagem"
                    className="flex size-11 cursor-pointer items-center justify-center rounded-full bg-destructive/90 text-destructive-foreground shadow-sm outline-none backdrop-blur-md transition-[background-color,scale] duration-150 hover:bg-destructive focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.96] sm:size-10"
                    onClick={removeFile}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        removeFile(e);
                      }
                    }}
                    type="button"
                  >
                    <HugeiconsIcon
                      aria-hidden="true"
                      icon={Cancel01Icon}
                      size={14}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">Remover capa</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
      <CourseCoverCropDialog
        file={pendingCropFile}
        onCancel={cancelCrop}
        onComplete={completeCrop}
      />
    </div>
  );
}
