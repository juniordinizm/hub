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
import {
  COURSE_COVER_ACCEPT,
  parseCourseCoverImage,
} from "@/features/storage/course-cover";
import { cn } from "@/lib/utils";

interface CourseCoverUploadFieldProps {
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
    toast.error("A imagem deve ter no maximo 4MB.");
    return false;
  }

  return true;
};

export function CourseCoverUploadField({
  className,
  defaultCoverImage,
  defaultThumbnailUrl,
}: CourseCoverUploadFieldProps): React.JSX.Element {
  const parsedCover = parseCourseCoverImage(defaultCoverImage);
  const [coverImageJson, setCoverImageJson] = useState(() =>
    parsedCover ? JSON.stringify(parsedCover) : ""
  );
  const [previewUrl, setPreviewUrl] = useState(defaultThumbnailUrl ?? "");
  const [previewBlurDataUrl, setPreviewBlurDataUrl] = useState(
    parsedCover?.blurDataUrl ?? null
  );
  const [isPreviewLoaded, setIsPreviewLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

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
    toast.success("Capa selecionada. Salve o curso para enviar.");
    return true;
  };

  const assignDroppedFile = (file: File): void => {
    if (!(inputRef.current && isValidCoverFile(file))) {
      return;
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    inputRef.current.files = dataTransfer.files;
    setLocalPreview(file);
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
      toast.error("Por favor, envie um arquivo de imagem valido.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const removeFile = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCoverImageJson("");
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

  return (
    <div className={cn("flex w-full flex-col gap-2 sm:w-[280px]", className)}>
      <input name="coverImage" type="hidden" value={coverImageJson} />

      <div className="relative aspect-video w-full">
        {/* biome-ignore lint/a11y/useSemanticElements: div is required for drag-and-drop drop zone with flexible sizing */}
        <div
          className={cn(
            "group relative flex h-full w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed transition-[border-color,background-color] duration-200 ease-out focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            isDragging ? "border-ring bg-muted" : "border-input hover:bg-muted",
            previewUrl ? "border-transparent border-solid" : ""
          )}
          onClick={() => inputRef.current?.click()}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
        >
          <input
            accept={COURSE_COVER_ACCEPT}
            className="sr-only"
            name="coverFile"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];

              if (file) {
                setLocalPreview(file);
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
                      : "animate-pulse motion-reduce:animate-none"
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
                  "absolute inset-0 size-full object-cover transition-opacity duration-200 motion-reduce:transition-none",
                  isPreviewLoaded ? "opacity-100" : "opacity-0"
                )}
                onLoad={() => setIsPreviewLoaded(true)}
                src={previewUrl}
              />
              <div className="pointer-events-none absolute inset-0 rounded-xl border border-black/10 dark:border-white/10" />

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
                  className="text-muted-foreground opacity-60"
                  icon={ImageUpload01Icon}
                  size={18}
                />
              </div>
              <p className="mb-1 font-medium text-sm leading-snug">
                Arraste ou clique para selecionar a capa
              </p>
              <p className="text-muted-foreground text-xs">
                PNG, JPG ou WebP ate 4MB
              </p>
            </div>
          )}
        </div>

        {previewUrl && (
          <div className="absolute top-3 right-3 z-50">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    aria-label="Remover imagem"
                    className="flex size-7 cursor-pointer items-center justify-center rounded-full bg-destructive/90 text-destructive-foreground shadow-sm outline-none backdrop-blur-md transition duration-150 hover:bg-destructive focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.96]"
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
    </div>
  );
}
