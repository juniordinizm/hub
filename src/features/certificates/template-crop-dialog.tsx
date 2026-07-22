"use client";

import {
  CropIcon,
  ZoomInAreaIcon,
  ZoomOutAreaIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  type CertificateCropArea,
  createCertificateCropFile,
} from "./template-crop";
import { CERTIFICATE_BACKGROUND_ASPECT_RATIO } from "./template-image-contract";

export function CertificateTemplateCropDialog({
  file,
  onCancel,
  onComplete,
}: {
  file: File | null;
  onCancel: () => void;
  onComplete: (file: File) => void;
}): React.JSX.Element {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [cropPixels, setCropPixels] = useState<CertificateCropArea | null>(
    null
  );
  const [isPreparing, setIsPreparing] = useState(false);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!file) {
      setCropPixels(null);
      setSourceUrl(null);
      setZoom(1);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setCrop({ x: 0, y: 0 });
    setCropPixels(null);
    setSourceUrl(nextUrl);
    setZoom(1);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  const complete = async (): Promise<void> => {
    if (!(file && cropPixels && sourceUrl)) {
      return;
    }
    setIsPreparing(true);
    try {
      onComplete(
        await createCertificateCropFile({
          crop: cropPixels,
          originalName: file.name,
          sourceUrl,
        })
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel recortar a arte."
      );
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <Dialog onOpenChange={(open) => !open && onCancel()} open={file !== null}>
      <DialogContent className="max-w-4xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Ajustar arte do certificado</DialogTitle>
          <p className="text-muted-foreground text-sm">
            Enquadre a imagem para a pagina A4 horizontal.
          </p>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-6 p-4 sm:p-6">
          {sourceUrl ? (
            <div className="relative h-72 overflow-hidden rounded-2xl border bg-muted sm:h-105">
              <Cropper
                aspect={CERTIFICATE_BACKGROUND_ASPECT_RATIO}
                crop={crop}
                image={sourceUrl}
                onCropChange={setCrop}
                onCropComplete={(_, area: Area) => setCropPixels(area)}
                onZoomChange={setZoom}
                showGrid
                zoom={zoom}
              />
            </div>
          ) : null}
          <div className="mx-auto flex w-full max-w-md items-center gap-4">
            <HugeiconsIcon
              className="shrink-0 text-muted-foreground"
              icon={ZoomOutAreaIcon}
              size={18}
            />
            <Slider
              aria-label="Zoom da arte"
              className="flex-1"
              max={3}
              min={1}
              onValueChange={(values) => setZoom(values[0] ?? 1)}
              step={0.05}
              value={[zoom]}
            />
            <HugeiconsIcon
              className="shrink-0 text-muted-foreground"
              icon={ZoomInAreaIcon}
              size={18}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            disabled={isPreparing}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancelar
          </Button>
          <Button
            disabled={!cropPixels || isPreparing}
            onClick={complete}
            type="button"
          >
            <HugeiconsIcon data-icon="inline-start" icon={CropIcon} size={16} />
            {isPreparing ? "Preparando..." : "Usar recorte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
