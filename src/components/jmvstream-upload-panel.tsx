"use client";

import { useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  completeJmvstreamUploadAction,
  createLessonForJmvstreamUploadAction,
  initJmvstreamUploadAction,
  retryJmvstreamDeleteAction,
} from "@/features/admin/actions";

interface UploadPart {
  ETag: string;
  PartNumber: number;
}

type PresignedUrl = string | { partNumber?: number; url: string };

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  const uploadSelectedFile = (): void => {
    const file = inputRef.current?.files?.[0];

    if (!file) {
      setError("Selecione um arquivo de video.");
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        setProgress(2);
        setStatus(
          lessonId ? "Preparando upload na JMVStream..." : "Criando aula..."
        );
        const targetLessonId = lessonId ?? (await createLessonForUpload());
        setStatus("Preparando upload na JMVStream...");
        const init = await initJmvstreamUploadAction({
          fileName: file.name,
          fileSize: file.size,
          lessonId: targetLessonId,
          uploadType: "multipart",
        });
        const urls = normalizePresignedUrls(init.presignedUrls);
        const chunkSize = Math.ceil(file.size / urls.length);
        const parts: UploadPart[] = [];

        for (const [index, item] of urls.entries()) {
          const start = index * chunkSize;
          const end = Math.min(start + chunkSize, file.size);
          const response = await fetch(item.url, {
            body: file.slice(start, end),
            headers: { "Content-Type": "application/octet-stream" },
            method: "PUT",
          });

          if (!response.ok) {
            throw new Error("A JMVStream recusou uma parte do upload.");
          }

          parts.push({
            ETag: response.headers.get("ETag") ?? "",
            PartNumber: item.partNumber,
          });
          setProgress(Math.round(((index + 1) / urls.length) * 90));
        }

        setStatus("Finalizando processamento...");
        await completeJmvstreamUploadAction({
          filename: file.name,
          lessonId: targetLessonId,
          objectName: init.objectName,
          parts,
          size: file.size,
          uploadId: init.uploadId,
          videoHash: init.videoHash,
        });
        setProgress(100);
        setStatus("Video enviado e vinculado a aula.");
        window.location.reload();
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Nao foi possivel enviar o video."
        );
        setStatus(null);
      }
    });
  };

  const createLessonForUpload = async (): Promise<string> => {
    const form = inputRef.current?.form;

    if (!form) {
      throw new Error("Formulario da aula nao encontrado.");
    }

    return await createLessonForJmvstreamUploadAction(new FormData(form));
  };

  const retryDelete = (): void => {
    if (!asset) {
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        await retryJmvstreamDeleteAction({ assetId: asset.id });
        window.location.reload();
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
              Envia o arquivo para a pasta do modulo e vincula o hash nesta
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
            disabled={isPending}
            ref={inputRef}
            type="file"
          />
          <Button
            disabled={isPending}
            onClick={uploadSelectedFile}
            type="button"
          >
            Enviar video
          </Button>
        </div>

        {status ? (
          <div className="space-y-2">
            <Progress className="h-2" value={progress} />
            <p className="text-muted-foreground text-xs">{status}</p>
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

const normalizePresignedUrls = (
  presignedUrls: PresignedUrl[]
): Array<{ partNumber: number; url: string }> =>
  presignedUrls.map((item, index) => {
    if (typeof item === "string") {
      return { partNumber: index + 1, url: item };
    }

    return {
      partNumber: item.partNumber ?? index + 1,
      url: item.url,
    };
  });
