"use client";

import { ZoomInAreaIcon, ZoomOutAreaIcon } from "@hugeicons/core-free-icons";
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
import {
  BANNER_IMAGE_ASPECT_RATIO,
  BANNER_IMAGE_HEIGHT,
  BANNER_IMAGE_WIDTH,
  validateBannerUploadRequest,
} from "@/features/storage/banner-image";
import { type BannerCropArea, createBannerCropFile } from "./banner-crop";

interface BannerCropDialogProps {
  file: File | null;
  onCancel: () => void;
  onComplete: (file: File) => void;
}

const toBannerCropArea = (area: Area): BannerCropArea => ({
  height: area.height,
  width: area.width,
  x: area.x,
  y: area.y,
});

export function BannerCropDialog({
  file,
  onCancel,
  onComplete,
}: BannerCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [cropPixels, setCropPixels] = useState<BannerCropArea | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!file) {
      setSourceUrl(null);
      setCropPixels(null);
      setZoom(1);
      return;
    }

    const nextSourceUrl = URL.createObjectURL(file);
    setSourceUrl(nextSourceUrl);
    setCrop({ x: 0, y: 0 });
    setCropPixels(null);
    setZoom(1);

    return () => URL.revokeObjectURL(nextSourceUrl);
  }, [file]);

  const handleComplete = async () => {
    if (!(file && sourceUrl && cropPixels)) {
      return;
    }

    setIsPreparing(true);

    try {
      const croppedFile = await createBannerCropFile({
        crop: cropPixels,
        originalName: file.name,
        sourceUrl,
      });
      validateBannerUploadRequest({
        contentType: croppedFile.type,
        sizeBytes: croppedFile.size,
      });
      onComplete(croppedFile);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel preparar o banner."
      );
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <Dialog onOpenChange={(open) => !open && onCancel()} open={file !== null}>
      <DialogContent className="max-w-4xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Ajustar enquadramento</DialogTitle>
          <p className="text-muted-foreground text-sm">
            Arraste a imagem e ajuste o zoom. O banner final tera{" "}
            {BANNER_IMAGE_WIDTH} × {BANNER_IMAGE_HEIGHT} px.
          </p>
        </DialogHeader>

        <DialogBody className="p-0">
          {sourceUrl ? (
            <div className="relative h-72 bg-black sm:h-105">
              <Cropper
                aspect={BANNER_IMAGE_ASPECT_RATIO}
                crop={crop}
                image={sourceUrl}
                onCropChange={setCrop}
                onCropComplete={(_, area) =>
                  setCropPixels(toBannerCropArea(area))
                }
                onZoomChange={setZoom}
                showGrid
                zoom={zoom}
              />
            </div>
          ) : null}
        </DialogBody>

        <DialogFooter className="items-center sm:justify-between">
          <div className="flex w-full items-center gap-3 sm:max-w-sm">
            <HugeiconsIcon
              aria-hidden="true"
              className="shrink-0 text-muted-foreground"
              icon={ZoomOutAreaIcon}
              size={16}
            />
            <input
              aria-label="Zoom da imagem"
              className="w-full accent-primary"
              max="3"
              min="1"
              onChange={(event) => setZoom(Number(event.target.value))}
              step="0.05"
              type="range"
              value={zoom}
            />
            <HugeiconsIcon
              aria-hidden="true"
              className="shrink-0 text-muted-foreground"
              icon={ZoomInAreaIcon}
              size={16}
            />
          </div>

          <div className="flex w-full justify-end gap-2 sm:w-auto">
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
              onClick={handleComplete}
              type="button"
            >
              {isPreparing ? "Preparando..." : "Usar recorte"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
