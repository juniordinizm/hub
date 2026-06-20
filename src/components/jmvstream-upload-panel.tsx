"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  completeJmvstreamUploadAction,
  initJmvstreamUploadAction,
  markJmvstreamUploadFailedAction,
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
  lessonId,
}: {
  asset?: JmvstreamUploadAsset | undefined;
  currentVideoHash: null | string;
  lessonId?: string | undefined;
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
          uploadPartProxyUrl: init.uploadPartProxyUrl,
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
        setProgress(100);
        setStatus("Video enviado. Sincronizando player oficial...");
        const playerReady = await waitForJmvstreamPlayer(lessonId);
        setStatus(
          playerReady
            ? "Video pronto para as alunas."
            : "Video enviado. Aguardando processamento na JMVStream."
        );
        router.refresh();
      } catch (uploadError) {
        const errorMessage =
          uploadError instanceof Error
            ? uploadError.message
            : "Nao foi possivel enviar o video.";

        if (activeVideoHash) {
          await markJmvstreamUploadFailedAction({
            lastError: errorMessage,
            videoHash: activeVideoHash,
          });
        }

        setError(errorMessage);
        setStatus(null);
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

  return (
    <section className="rounded-lg border bg-background/40 p-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-sm">Upload JMVStream</h3>
            <p className="mt-1 text-muted-foreground text-xs">
              Envia o arquivo para a galeria do modulo e vincula o hash nesta
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
            Hash manual atual: {currentVideoHash}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            accept="video/*"
            disabled={isPending || !lessonId}
            ref={inputRef}
            type="file"
          />
          <Button
            disabled={isPending || !lessonId}
            onClick={uploadSelectedFile}
            type="button"
          >
            Enviar video
          </Button>
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
