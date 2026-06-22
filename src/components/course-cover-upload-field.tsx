"use client";

import { ImageUpload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  COURSE_COVER_ACCEPT,
  COURSE_COVER_VARIANTS,
  type CourseCoverImage,
  type CourseCoverVariant,
  parseCourseCoverImage,
} from "@/features/storage/course-cover";

interface CourseCoverUploadFieldProps {
  courseId: string;
  defaultCoverImage?: unknown;
  defaultThumbnailUrl?: string | null;
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
  hero: 0.86,
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
        `/api/admin/courses/${courseId}/cover/upload-url`,
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

  return (
    <div className="flex flex-col gap-3">
      <input name="coverImage" type="hidden" value={coverImageJson} />
      <div className="grid gap-3 sm:grid-cols-[160px_1fr] sm:items-center">
        <div className="aspect-video overflow-hidden rounded-md border bg-muted">
          {previewUrl ? (
            <div
              aria-label="Previa da capa do curso"
              className="size-full bg-center bg-cover"
              role="img"
              style={{ backgroundImage: `url(${previewUrl})` }}
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground text-xs">
              Sem capa
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Input
            accept={COURSE_COVER_ACCEPT}
            disabled={isUploading}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";

              if (file) {
                uploadCover(file).catch(() => undefined);
              }
            }}
            type="file"
          />
          <p className="inline-flex items-center gap-2 text-muted-foreground text-xs">
            <HugeiconsIcon icon={ImageUpload01Icon} size={16} strokeWidth={2} />
            {isUploading ? "Enviando capa..." : "Variantes automaticas"}
          </p>
        </div>
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
