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
  BANNER_IMAGE_ASPECT_RATIO,
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
          <DialogTitle>Ajustar imagem</DialogTitle>
          <p className="text-muted-foreground text-sm">
            Arraste e use o zoom para definir o enquadramento do banner.
          </p>
        </DialogHeader>

        <DialogBody className="space-y-6 p-4 sm:p-6">
          {sourceUrl ? (
            <div className="relative h-72 overflow-hidden rounded-2xl border border-black/5 bg-muted/30 shadow-inner sm:h-105 dark:border-white/5">
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

          <div className="mx-auto flex w-full max-w-md items-center gap-4">
            <HugeiconsIcon
              aria-hidden="true"
              className="shrink-0 text-muted-foreground"
              icon={ZoomOutAreaIcon}
              size={18}
            />
            <Slider
              aria-label="Zoom da imagem"
              className="flex-1"
              max={3}
              min={1}
              onValueChange={(values) => setZoom(values[0] ?? 1)}
              step={0.05}
              value={[zoom]}
            />
            <HugeiconsIcon
              aria-hidden="true"
              className="shrink-0 text-muted-foreground"
              icon={ZoomInAreaIcon}
              size={18}
            />
          </div>
        </DialogBody>

        <DialogFooter className="items-center sm:justify-end">
          <div className="flex w-full justify-end gap-3 sm:w-auto">
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
              {isPreparing ? (
                "Preparando..."
              ) : (
                <>
                  <HugeiconsIcon className="mr-2" icon={CropIcon} size={16} />
                  Confirmar
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
