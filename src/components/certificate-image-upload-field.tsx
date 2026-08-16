"use client";

import { Cancel01Icon, ImageUpload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CERTIFICATE_IMAGE_ACCEPT,
  type CertificateImageKind,
  validateCertificateImageFile,
} from "@/features/certificates/template-image-contract";
import { cn } from "@/lib/utils";

interface CertificateImageUploadFieldProps {
  className?: string;
  compact?: boolean;
  compactWhenImage?: boolean;
  id?: string;
  imageName?: string | null | undefined;
  imageUrl: string | null;
  kind: CertificateImageKind;
  label?: string;
  onFileSelect: (file: File | null) => void;
  required?: boolean;
  selectedFile?: File | null;
}

export function CertificateImageUploadField({
  className,
  compact = false,
  compactWhenImage = false,
  id,
  imageUrl,
  imageName,
  kind,
  label = "Arraste ou clique para selecionar a imagem",
  onFileSelect,
  required,
  selectedFile,
}: CertificateImageUploadFieldProps): React.JSX.Element {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!(input && typeof DataTransfer !== "undefined")) {
      return;
    }
    const transfer = new DataTransfer();
    if (selectedFile) {
      transfer.items.add(selectedFile);
    }
    input.files = transfer.files;
  }, [selectedFile]);

  const selectFile = (file: File): void => {
    try {
      validateCertificateImageFile(file, kind);
      onFileSelect(file);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível usar a imagem."
      );
    }
  };

  const openPicker = (): void => inputRef.current?.click();

  return (
    <div
      className={cn("flex flex-col gap-3", className)}
      data-compact-upload={imageUrl && compactWhenImage ? kind : undefined}
    >
      <input
        accept={CERTIFICATE_IMAGE_ACCEPT}
        aria-label={
          kind === "background"
            ? "Selecionar arte de fundo"
            : "Selecionar imagem da assinatura"
        }
        className="sr-only"
        data-upload-kind={kind}
        id={id}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) {
            selectFile(file);
          }
        }}
        ref={inputRef}
        required={required && !imageUrl}
        type="file"
      />

      {imageUrl && compactWhenImage ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 ring-1 ring-foreground/5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
            <span className="truncate text-sm">
              {selectedFile?.name ?? imageName ?? "Imagem atual"}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              className="min-h-10"
              onClick={openPicker}
              size="sm"
              type="button"
              variant="ghost"
            >
              Substituir imagem
            </Button>
            <Button
              aria-label="Remover imagem"
              className="min-h-10"
              onClick={() => onFileSelect(null)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Remover
            </Button>
          </div>
        </div>
      ) : (
        <Button
          className={cn(
            "w-full flex-col border-dashed text-center transition-[border-color,background-color,scale] active:scale-[0.96] data-[dragging=true]:border-primary data-[dragging=true]:bg-primary/5",
            compact ? "min-h-16 gap-1.5 py-2" : "min-h-24 gap-2"
          )}
          data-dragging={isDragging}
          onClick={openPicker}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) {
              selectFile(file);
            }
          }}
          type="button"
          variant="outline"
        >
          <HugeiconsIcon data-icon="inline-start" icon={ImageUpload01Icon} />
          <span className="text-muted-foreground text-sm">{label}</span>
          <span className="text-xs">
            {kind === "background"
              ? "JPG, PNG ou WebP até 10 MB"
              : "JPG, PNG ou WebP até 2 MB"}
          </span>
        </Button>
      )}

      {imageUrl && !compactWhenImage ? (
        <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
          <span className="truncate text-muted-foreground text-sm">
            {selectedFile?.name ?? imageName ?? "Imagem atual"}
          </span>
          <Button
            aria-label="Remover imagem"
            className="min-h-10"
            onClick={() => onFileSelect(null)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon data-icon="inline-start" icon={Cancel01Icon} />
            Remover
          </Button>
        </div>
      ) : null}
    </div>
  );
}
