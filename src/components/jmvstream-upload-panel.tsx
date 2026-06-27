"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  completeJmvstreamUploadAction,
  initJmvstreamUploadAction,
  markJmvstreamUploadFailedAction,
  removeJmvstreamVideoFromLessonAction,
  retryJmvstreamDeleteAction,
  syncJmvstreamLessonPlayerAction,
} from "@/features/admin/actions";
import { uploadFileParts } from "@/features/jmvstream/upload";

const PLAYER_SYNC_ATTEMPTS = 18;
const PLAYER_SYNC_INTERVAL_MS = 5000;

export interface JmvstreamUploadAsset {
  deleteStatus: string;
  filename: string;
  galleryUuid: string | null;
  id: string;
  lastError: string | null;
  uploadStatus: string;
  videoHash: string;
}

export function JmvstreamUploadPanel({
  asset,
  currentVideoHash,
  isRemovePending = false,
  lessonId,
  onRemoveVideo,
}: {
  asset?: JmvstreamUploadAsset | undefined;
  currentVideoHash: null | string;
  isRemovePending?: boolean;
  lessonId?: string | undefined;
  onRemoveVideo?: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  const uploadSelectedFile = (): void => {
    const file = inputRef.current?.files?.[0];

    if (!lessonId) {
      setError("Crie a aula antes de enviar o video.");
      return;
    }

    if (!file) {
      setError("Selecione um arquivo de video.");
      return;
    }

    startTransition(async () => {
      let activeVideoHash: string | null = null;
      let uploadCompleted = false;
      try {
        setError(null);
        setProgress(2);
        setStatus("Preparando upload na JMVStream...");
        const initResult = await initJmvstreamUploadAction({
          fileName: file.name,
          fileSize: file.size,
          lessonId,
          uploadType: "multipart",
        });
        if (!initResult.ok) {
          throw new Error(initResult.error);
        }

        const init = initResult.data;
        activeVideoHash = init.videoHash;
        setStatus("Enviando partes do video...");
        const parts = await uploadFileParts({
          file,
          onProgress: setProgress,
          presignedUrls: init.presignedUrls,
        });

        setStatus("Finalizando processamento...");
        await completeJmvstreamUploadAction({
          filename: file.name,
          lessonId,
          objectName: init.objectName,
          parts,
          size: file.size,
          uploadSessionId: init.uploadSessionId,
          uploadId: init.uploadId,
          videoHash: init.videoHash,
        });
        uploadCompleted = true;
        setProgress(100);
        setStatus("Video enviado. Sincronizando player oficial...");
        setStatus(await syncJmvstreamPlayerStatus(lessonId));
        router.refresh();
      } catch (uploadError) {
        const errorMessage = getUploadErrorMessage(uploadError);

        if (activeVideoHash && !uploadCompleted) {
          await markJmvstreamUploadFailedAction({
            lastError: errorMessage,
            videoHash: activeVideoHash,
          });
        }

        setError(uploadCompleted ? null : errorMessage);
        setStatus(getUploadFailureStatus(uploadCompleted));
      }
    });
  };

  const retryDelete = (): void => {
    if (!asset) {
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        await retryJmvstreamDeleteAction({ assetId: asset.id });
        router.refresh();
      } catch (retryError) {
        setError(
          retryError instanceof Error
            ? retryError.message
            : "Nao foi possivel apagar o video na JMVStream."
        );
      }
    });
  };

  const removeVideo = (): void => {
    if (!lessonId) {
      setError("Aula invalida.");
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        setStatus("Removendo video da JMVStream...");
        const result = await removeJmvstreamVideoFromLessonAction({ lessonId });
        onRemoveVideo?.();
        setStatus(
          result.deletePending
            ? "Video removido da aula. Exclusao na JMVStream pendente."
            : "Video removido."
        );
        router.refresh();
      } catch (removeError) {
        setError(
          removeError instanceof Error
            ? removeError.message
            : "Nao foi possivel remover o video da JMVStream."
        );
        setStatus(null);
      }
    });
  };

  return (
    <section className="min-w-0">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm">Upload JMVStream</h3>
            <p className="mt-1 text-muted-foreground text-xs">
              Envia o arquivo para a galeria do curso e vincula o hash nesta
              aula.
            </p>
          </div>
          <Badge variant={asset ? "default" : "outline"}>
            {asset ? asset.deleteStatus : "sem asset"}
          </Badge>
        </div>

        {asset ? (
          <div className="rounded-md border bg-card px-3 py-2 text-xs">
            <p className="font-medium">{asset.filename}</p>
            <p className="mt-1 break-all text-muted-foreground">
              {asset.videoHash}
            </p>
            {asset.lastError ? (
              <p className="mt-2 text-destructive">{asset.lastError}</p>
            ) : null}
          </div>
        ) : null}
        {!asset && currentVideoHash ? (
          <p className="rounded-md border bg-card px-3 py-2 text-muted-foreground text-xs">
            Hash JMVStream atual: {currentVideoHash}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <Input
            accept="video/*"
            className="w-full"
            disabled={isPending || !lessonId}
            ref={inputRef}
            type="file"
          />
          <div className="flex flex-col justify-end gap-2 sm:flex-row">
            {currentVideoHash && onRemoveVideo ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="w-full sm:w-auto"
                    disabled={isPending || isRemovePending}
                    type="button"
                    variant="destructive"
                  >
                    Remover vídeo
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover vídeo</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja remover o vídeo desta aula? Esta
                      ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={removeVideo}>
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
            <Button
              className="w-full sm:w-auto"
              disabled={isPending || !lessonId}
              onClick={uploadSelectedFile}
              type="button"
            >
              Enviar video
            </Button>
          </div>
        </div>
        {lessonId ? null : (
          <p className="text-muted-foreground text-xs">
            Crie a aula para habilitar o upload do arquivo.
          </p>
        )}

        {status ? (
          <div className="flex flex-col gap-2">
            <Progress className="h-2" value={progress} />
            <p className="text-muted-foreground text-xs">{status}</p>
            <UploadTimeline
              progress={progress}
              status={asset?.uploadStatus ?? null}
            />
          </div>
        ) : null}

        {asset?.deleteStatus === "failed" ? (
          <Button
            className="w-fit"
            disabled={isPending}
            onClick={retryDelete}
            size="sm"
            type="button"
            variant="outline"
          >
            Tentar apagar novamente
          </Button>
        ) : null}

        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </div>
    </section>
  );
}

const waitForJmvstreamPlayer = async (lessonId: string): Promise<boolean> => {
  for (let attempt = 0; attempt < PLAYER_SYNC_ATTEMPTS; attempt += 1) {
    const result = await syncJmvstreamLessonPlayerAction({ lessonId });

    if (result.ready) {
      return true;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, PLAYER_SYNC_INTERVAL_MS)
    );
  }

  return false;
};

const syncJmvstreamPlayerStatus = async (lessonId: string): Promise<string> => {
  try {
    const playerReady = await waitForJmvstreamPlayer(lessonId);

    if (playerReady) {
      return "Video pronto para as alunas.";
    }
  } catch {
    return "Video enviado. Aguardando processamento na JMVStream.";
  }

  return "Video enviado. Aguardando processamento na JMVStream.";
};

const getUploadErrorMessage = (uploadError: unknown): string => {
  if (uploadError instanceof Error) {
    return uploadError.message;
  }

  return "Nao foi possivel enviar o video.";
};

const getUploadFailureStatus = (uploadCompleted: boolean): null | string =>
  uploadCompleted
    ? "Video enviado. Aguardando processamento na JMVStream."
    : null;

function UploadTimeline({
  progress,
  status,
}: {
  progress: number;
  status: null | string;
}): React.JSX.Element {
  const steps = [
    ["Preparando", progress >= 2],
    ["Enviando", progress > 2],
    ["Finalizando", progress >= 90],
    ["Processando", progress === 100 || status === "processing"],
    ["Pronto", status === "ready"],
  ] as const;

  return (
    <div className="flex flex-wrap gap-1.5">
      {steps.map(([label, isActive]) => (
        <Badge key={label} variant={isActive ? "default" : "outline"}>
          {label}
        </Badge>
      ))}
    </div>
  );
}
