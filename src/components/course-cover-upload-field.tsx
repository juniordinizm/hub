"use client";

import { Cancel01Icon, ImageUpload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  COURSE_COVER_ACCEPT,
  COURSE_COVER_VARIANTS,
  type CourseCoverImage,
  type CourseCoverVariant,
  parseCourseCoverImage,
} from "@/features/storage/course-cover";
import { cn } from "@/lib/utils";

interface CourseCoverUploadFieldProps {
  courseId: string;
  defaultCoverImage?: unknown;
  defaultThumbnailUrl?: string | null | undefined;
}

interface GeneratedVariant {
  blob: Blob;
  contentType: string;
  sizeBytes: number;
  variant: CourseCoverVariant;
}

interface SignedCoverUploadPayload {
  coverImage: CourseCoverImage;
  uploads: Array<{
    contentType: string;
    key: string;
    uploadUrl: string;
    variant: CourseCoverVariant | "original";
  }>;
}

const VARIANT_QUALITY: Record<CourseCoverVariant, number> = {
  card: 0.82,
  thumb: 0.8,
};

const readImage = async (file: File): Promise<HTMLImageElement> =>
  await new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Nao foi possivel ler a imagem."));
    };
    image.src = url;
  });

const canvasToBlob = async (
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> =>
  await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Nao foi possivel gerar a variante da capa."));
      },
      "image/webp",
      quality
    );
  });

const createCoverVariant = async ({
  image,
  variant,
}: {
  image: HTMLImageElement;
  variant: CourseCoverVariant;
}): Promise<GeneratedVariant> => {
  const dimensions = COURSE_COVER_VARIANTS[variant];
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = dimensions.width / dimensions.height;
  const sourceWidth =
    sourceRatio > targetRatio
      ? image.naturalHeight * targetRatio
      : image.naturalWidth;
  const sourceHeight =
    sourceRatio > targetRatio
      ? image.naturalHeight
      : image.naturalWidth / targetRatio;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas indisponivel para gerar a capa.");
  }

  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    dimensions.width,
    dimensions.height
  );

  const blob = await canvasToBlob(canvas, VARIANT_QUALITY[variant]);

  return {
    blob,
    contentType: "image/webp",
    sizeBytes: blob.size,
    variant,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isSignedCoverUploadPayload = (
  value: unknown
): value is SignedCoverUploadPayload =>
  isRecord(value) && Array.isArray(value.uploads) && Boolean(value.coverImage);

const readUploadError = (value: unknown): string => {
  if (isRecord(value) && typeof value.error === "string") {
    return value.error;
  }

  return "Nao foi possivel preparar o upload da capa.";
};

export function CourseCoverUploadField({
  courseId,
  defaultCoverImage,
  defaultThumbnailUrl,
}: CourseCoverUploadFieldProps): React.JSX.Element {
  const parsedCover = parseCourseCoverImage(defaultCoverImage);
  const [coverImageJson, setCoverImageJson] = useState(() =>
    parsedCover ? JSON.stringify(parsedCover) : ""
  );
  const [previewUrl, setPreviewUrl] = useState(defaultThumbnailUrl ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [effectiveCourseId, setEffectiveCourseId] = useState<string | null>(
    courseId || null
  );

  useEffect(() => {
    if (!courseId) {
      setEffectiveCourseId(crypto.randomUUID());
    }
  }, [courseId]);

  const isNewCourse = !courseId;

  if (!effectiveCourseId) {
    return (
      <div className="flex w-full flex-col gap-2 sm:w-[280px]">
        <Skeleton className="aspect-video w-full rounded-xl" />
      </div>
    );
  }

  const uploadCover = async (file: File): Promise<void> => {
    const toastId = toast.loading("Preparando capa...");
    setIsUploading(true);

    try {
      const image = await readImage(file);
      const variants = await Promise.all(
        (Object.keys(COURSE_COVER_VARIANTS) as CourseCoverVariant[]).map(
          (variant) => createCoverVariant({ image, variant })
        )
      );
      const signedResponse = await fetch(
        `/api/admin/courses/${effectiveCourseId}/cover/upload-url`,
        {
          body: JSON.stringify({
            original: {
              contentType: file.type,
              fileName: file.name,
              sizeBytes: file.size,
            },
            variants: variants.map(({ contentType, sizeBytes, variant }) => ({
              contentType,
              sizeBytes,
              variant,
            })),
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }
      );
      const signedPayload: unknown = await signedResponse.json();

      if (!(signedResponse.ok && isSignedCoverUploadPayload(signedPayload))) {
        throw new Error(readUploadError(signedPayload));
      }

      const originalUpload = signedPayload.uploads.find(
        (upload) => upload.variant === "original"
      );

      if (!originalUpload) {
        throw new Error("Upload original da capa indisponivel.");
      }

      await uploadBlob({
        blob: file,
        contentType: file.type,
        uploadUrl: originalUpload.uploadUrl,
      });

      for (const variant of variants) {
        const upload = signedPayload.uploads.find(
          (candidate) => candidate.variant === variant.variant
        );

        if (!upload) {
          throw new Error("Upload de variante da capa indisponivel.");
        }

        await uploadBlob({
          blob: variant.blob,
          contentType: variant.contentType,
          uploadUrl: upload.uploadUrl,
        });
      }

      setCoverImageJson(JSON.stringify(signedPayload.coverImage));
      setPreviewUrl(URL.createObjectURL(file));
      toast.success("Capa enviada. Salve o curso para publicar.", {
        id: toastId,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel enviar a capa.",
        { id: toastId }
      );
    } finally {
      setIsUploading(false);
    }
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

    if (isUploading) {
      return;
    }

    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) {
      uploadCover(file).catch(() => undefined);
    } else if (file) {
      toast.error("Por favor, envie um arquivo de imagem válido.");
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
    setPreviewUrl("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="flex w-full flex-col gap-2 sm:w-[280px]">
      <input name="coverImage" type="hidden" value={coverImageJson} />
      {isNewCourse && (
        <input name="pendingCourseId" type="hidden" value={effectiveCourseId} />
      )}

      <div className="relative aspect-video w-full">
        {/* biome-ignore lint/a11y/useSemanticElements: div is required for drag-and-drop drop zone with flexible sizing */}
        <div
          className={cn(
            "group relative flex h-full w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed transition-[border-color,background-color] duration-200 ease-out focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            isDragging ? "border-ring bg-muted" : "border-input hover:bg-muted",
            isUploading ? "pointer-events-none opacity-80" : "",
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
            disabled={isUploading}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";

              if (file) {
                uploadCover(file).catch(() => undefined);
              }
            }}
            ref={inputRef}
            type="file"
          />

          {previewUrl ? (
            <>
              {/* biome-ignore lint/performance/noImgElement: preview is a blob URL, not optimizable by next/image */}
              {/* biome-ignore lint/correctness/useImageSize: image fills container via CSS */}
              <img
                alt="Capa do curso"
                className="absolute inset-0 size-full object-cover"
                src={previewUrl}
              />
              <div className="pointer-events-none absolute inset-0 rounded-xl border border-black/10 dark:border-white/10" />

              <div
                className={cn(
                  "absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm transition-opacity duration-200 ease-out",
                  isUploading
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                )}
              >
                {isUploading ? (
                  <p className="animate-pulse font-medium text-sm">
                    Processando capa...
                  </p>
                ) : (
                  <p className="font-medium text-sm">
                    Clique para alterar a capa
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-full border bg-background">
                <HugeiconsIcon
                  className={cn(
                    "text-muted-foreground opacity-60",
                    isUploading && "animate-pulse"
                  )}
                  icon={ImageUpload01Icon}
                  size={20}
                />
              </div>
              <p className="mb-1 font-medium text-sm">
                {isUploading
                  ? "Enviando e processando..."
                  : "Arraste ou clique para enviar a capa"}
              </p>
              <p className="text-muted-foreground text-xs">
                {isUploading
                  ? "Isso pode levar alguns segundos"
                  : "PNG, JPG ou WebP até 5MB"}
              </p>
            </div>
          )}
        </div>

        {previewUrl && !isUploading && (
          <div className="absolute top-3 right-3 z-50">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    aria-label="Remover imagem"
                    className="flex size-7 cursor-pointer items-center justify-center rounded-full bg-destructive/90 text-destructive-foreground shadow-sm outline-none backdrop-blur-md transition-colors hover:bg-destructive focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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

const uploadBlob = async ({
  blob,
  contentType,
  uploadUrl,
}: {
  blob: Blob;
  contentType: string;
  uploadUrl: string;
}): Promise<void> => {
  const response = await fetch(uploadUrl, {
    body: blob,
    headers: { "Content-Type": contentType },
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel enviar a capa para o R2.");
  }
};
