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
  id?: string;
  imageUrl: string | null;
  kind: CertificateImageKind;
  label?: string;
  name: string;
  onFileSelect: (file: File | null) => void;
  required?: boolean;
  selectedFile?: File | null;
}

export function CertificateImageUploadField({
  className,
  id,
  imageUrl,
  kind,
  label = "Arraste ou clique para selecionar a imagem",
  name,
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
          : "Nao foi possivel usar a imagem."
      );
    }
  };

  const openPicker = (): void => inputRef.current?.click();

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <input
        accept={CERTIFICATE_IMAGE_ACCEPT}
        className="sr-only"
        id={id}
        name={name}
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

      <Button
        className="min-h-24 w-full flex-col gap-2 border-dashed text-center transition-[border-color,background-color,scale] active:scale-[0.96] data-[dragging=true]:border-primary data-[dragging=true]:bg-primary/5"
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
            ? "JPG, PNG ou WebP ate 10 MB"
            : "JPG, PNG ou WebP ate 2 MB"}
        </span>
      </Button>

      {imageUrl ? (
        <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
          <span className="truncate text-muted-foreground text-sm">
            {selectedFile?.name ?? "Imagem atual"}
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
