"use client";

import {
  Alert01Icon,
  CloudUploadIcon,
  Delete02Icon,
  Loading02Icon,
  ReloadIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
const PROCESSING_POLL_INTERVAL_MS = 15_000;

export interface JmvstreamUploadAsset {
  deleteStatus: string;
  filename: string;
  galleryUuid: string | null;
  id: string;
  lastError: string | null;
  uploadStatus: string;
  videoHash: string;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Upload component requires complex state handling
export function JmvstreamUploadPanel({
  asset,
  currentVideoHash,
  hasManualLinkApplied = false,
  isRemovePending = false,
  lessonId,
  manualLinkActiveCard,
  manualLinkSlot,
  onPlayerReady,
  onRemoveVideo,
}: {
  asset?: JmvstreamUploadAsset | undefined;
  currentVideoHash: null | string;
  hasManualLinkApplied?: boolean;
  isRemovePending?: boolean;
  lessonId?: string | undefined;
  manualLinkActiveCard?: React.ReactNode;
  manualLinkSlot?: React.ReactNode;
  onPlayerReady?: (playerUrl: string) => void;
  onRemoveVideo?: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [isLocalProcessing, setIsLocalProcessing] = useState(false);
  const [localFilename, setLocalFilename] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (asset) {
      setIsLocalProcessing(false);
    }
  }, [asset]);
  const [status, setStatus] = useState<string | null>(null);
  const isProcessing =
    asset?.uploadStatus === "processing" || isLocalProcessing;
  const isUploadActive = Boolean(
    asset ||
      isUploading ||
      isProcessing ||
      (currentVideoHash && !hasManualLinkApplied)
  );

  const syncProcessingPlayer = useCallback(async (): Promise<void> => {
    if (!lessonId) {
      return;
    }

    try {
      setError(null);
      setStatus("Verificando player na JMVStream...");
      const result = await syncJmvstreamLessonPlayerAction({ lessonId });

      if (result.ready && result.playerUrl) {
        onPlayerReady?.(result.playerUrl);
        setStatus("Video pronto para as alunas.");
        router.refresh();
        return;
      }

      setStatus("Video enviado. Aguardando processamento na JMVStream.");
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Nao foi possivel verificar o player na JMVStream."
      );
    }
  }, [lessonId, onPlayerReady, router]);

  useEffect(() => {
    if (!isUploading) {
      return;
    }

    const warnBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isUploading]);

  useEffect(() => {
    if (!(isProcessing && lessonId)) {
      return;
    }

    const interval = window.setInterval(
      syncProcessingPlayer,
      PROCESSING_POLL_INTERVAL_MS
    );

    return () => window.clearInterval(interval);
  }, [isProcessing, lessonId, syncProcessingPlayer]);

  const uploadSelectedFile = (droppedFile?: File): void => {
    const file = droppedFile || inputRef.current?.files?.[0];

    if (!lessonId) {
      setError("Crie a aula antes de enviar o video.");
      return;
    }

    if (!file) {
      setError("Selecione um arquivo de video.");
      return;
    }

    // Feedback visual imediato fora da transition
    setError(null);
    setIsUploading(true);
    setLocalFilename(file.name);
    setProgress(2);
    setStatus("Etapa 1/4: Iniciando conexão segura...");

    startTransition(async () => {
      let activeVideoHash: string | null = null;
      let uploadCompleted = false;
      try {
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
        setStatus("Etapa 2/4: Enviando arquivo para a nuvem...");
        const parts = await uploadFileParts({
          chunkSize: init.chunkSize,
          file,
          onProgress: setProgress,
          presignedUrls: init.presignedUrls,
        });

        setIsUploading(false);
        setIsLocalProcessing(true);
        setStatus("Etapa 3/4: Montando arquivo final...");
        toast.info("Upload concluído. Processando na JMVStream...");
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
        setStatus("Etapa 4/4: Sincronizando o player oficial...");
        const playerSync = await syncJmvstreamPlayerStatus(lessonId);
        setStatus(playerSync.status);
        if (playerSync.playerUrl) {
          onPlayerReady?.(playerSync.playerUrl);
          toast.success("Vídeo pronto para reprodução!");
        } else {
          toast.success(
            "Vídeo enviado com sucesso. Processamento continua em background."
          );
        }
        router.refresh();
      } catch (uploadError) {
        setIsUploading(false);
        const errorMessage = getUploadErrorMessage(uploadError);

        if (activeVideoHash && !uploadCompleted) {
          await markJmvstreamUploadFailedAction({
            lastError: errorMessage,
            videoHash: activeVideoHash,
          });
        }

        setError(uploadCompleted ? null : errorMessage);
        setStatus(getUploadFailureStatus(uploadCompleted));
        if (!uploadCompleted) {
          toast.error(`Falha no upload: ${errorMessage}`);
        }
      }
    });
  };

  const retryDelete = (): void => {
    if (!asset) {
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const retryResult = await retryJmvstreamDeleteAction({
          assetId: asset.id,
        });
        if (!retryResult.ok) {
          throw new Error(retryResult.error);
        }
        toast.success("Solicitação de exclusão reenviada.");
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

    setError(null);
    setStatus("Removendo video da JMVStream...");
    const toastId = toast.loading("Removendo vídeo...");
    startTransition(async () => {
      try {
        const result = await removeJmvstreamVideoFromLessonAction({ lessonId });
        onRemoveVideo?.();
        setStatus(
          result.deletePending
            ? "Video removido da aula. Exclusao na JMVStream pendente."
            : "Video removido."
        );
        toast.success("Vídeo removido com sucesso.", { id: toastId });
        router.refresh();
      } catch (removeError) {
        setError(
          removeError instanceof Error
            ? removeError.message
            : "Nao foi possivel remover o video da JMVStream."
        );
        setStatus(null);
        toast.error("Erro ao remover o vídeo.", { id: toastId });
      }
    });
  };

  return (
    <section className="min-w-0">
      <div className="flex min-w-0 flex-col gap-4">
        {!(isUploadActive || hasManualLinkApplied) && (
          <div className="flex flex-col gap-6">
            {manualLinkSlot && (
              <div className="flex flex-col gap-5">
                {manualLinkSlot}
                <div className="relative flex items-center">
                  <div className="grow border-t" />
                  <span className="shrink-0 px-4 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                    OU
                  </span>
                  <div className="grow border-t" />
                </div>
              </div>
            )}

            {/* biome-ignore lint/a11y/useKeyWithClickEvents: Dropzone Container */}
            {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Dropzone Container */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: Dropzone Container */}
            <div
              className="group relative flex cursor-pointer flex-col items-center justify-between gap-4 rounded-xl border border-border border-dashed bg-muted/20 p-5 transition-colors hover:border-ring/50 hover:bg-muted/30 sm:flex-row"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  uploadSelectedFile(file);
                }
              }}
            >
              <Input
                accept="video/*"
                className="hidden"
                disabled={isPending || !lessonId}
                onChange={() => uploadSelectedFile()}
                ref={inputRef}
                type="file"
              />

              <div className="flex items-center gap-3 text-left">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background shadow-sm transition-transform duration-300 ease-out group-hover:scale-105">
                  <HugeiconsIcon
                    className="text-muted-foreground"
                    icon={CloudUploadIcon}
                    size={20}
                  />
                </div>
                <div>
                  <h4 className="font-medium text-sm">Upload de vídeo</h4>
                  <p className="text-muted-foreground text-xs">
                    Arraste para cá ou clique para buscar
                  </p>
                </div>
              </div>

              <Button
                className="w-full shrink-0 transition-transform active:scale-[0.97] sm:w-auto"
                disabled={isPending || !lessonId}
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                Procurar arquivo
              </Button>
            </div>

            {error && !currentVideoHash && (
              <div className="relative z-20 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-destructive text-xs">
                <HugeiconsIcon
                  className="shrink-0"
                  icon={Alert01Icon}
                  size={14}
                />
                <p className="truncate">{error}</p>
              </div>
            )}

            {!lessonId && (
              <div className="absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm">
                <p className="font-medium text-muted-foreground text-sm">
                  Crie a aula primeiro para habilitar o upload
                </p>
              </div>
            )}
          </div>
        )}

        {isUploadActive && (
          <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 starting:opacity-0 shadow-sm transition-all duration-300 ease-out">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <HugeiconsIcon
                    className={
                      isUploading || isProcessing ? "animate-spin" : ""
                    }
                    icon={
                      isUploading || isProcessing ? Loading02Icon : Video01Icon
                    }
                    size={20}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1 pt-0.5">
                  <p className="truncate font-medium text-sm">
                    {asset?.filename || localFilename || "Arquivo de vídeo"}
                  </p>
                  {currentVideoHash && (
                    <p className="truncate font-mono text-muted-foreground text-xs">
                      Hash: {currentVideoHash}
                    </p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    {isUploading
                      ? status
                      : getAssetStatusLabel(
                          asset?.uploadStatus ||
                            (isLocalProcessing ? "processing" : "ready")
                        )}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {isProcessing && (
                  <Button
                    className="transition-transform active:scale-[0.97]"
                    disabled={isPending}
                    onClick={syncProcessingPlayer}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <HugeiconsIcon
                      className="mr-1.5 -ml-0.5"
                      icon={ReloadIcon}
                      size={14}
                    />
                    Verificar player agora
                  </Button>
                )}
                {asset?.deleteStatus === "failed" && (
                  <Button
                    className="transition-transform active:scale-[0.97]"
                    disabled={isPending}
                    onClick={retryDelete}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Tentar apagar novamente
                  </Button>
                )}
                {currentVideoHash && onRemoveVideo && !isUploading && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        className="transition-transform active:scale-[0.97]"
                        disabled={isPending || isRemovePending}
                        size="sm"
                        type="button"
                        variant="destructive"
                      >
                        <HugeiconsIcon
                          className={
                            isPending
                              ? "mr-1.5 -ml-0.5 animate-spin"
                              : "mr-1.5 -ml-0.5"
                          }
                          icon={isPending ? Loading02Icon : Delete02Icon}
                          size={14}
                        />
                        {isPending ? "Removendo..." : "Remover"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover vídeo</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja remover o vídeo desta aula?
                          Esta ação não pode ser desfeita.
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
                )}
              </div>
            </div>

            {isUploading && (
              <div className="flex items-center gap-3">
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                  {Math.round(progress)}%
                </span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-destructive text-xs">
                <HugeiconsIcon
                  className="shrink-0"
                  icon={Alert01Icon}
                  size={14}
                />
                <p>{error}</p>
              </div>
            )}
          </div>
        )}

        {hasManualLinkApplied && !isUploadActive && manualLinkActiveCard}
      </div>
    </section>
  );
}

const waitForJmvstreamPlayer = async (
  lessonId: string
): Promise<{ playerUrl: null | string; ready: boolean }> => {
  for (let attempt = 0; attempt < PLAYER_SYNC_ATTEMPTS; attempt += 1) {
    const result = await syncJmvstreamLessonPlayerAction({ lessonId });

    if (result.ready) {
      return {
        playerUrl: result.playerUrl,
        ready: true,
      };
    }

    await new Promise((resolve) =>
      setTimeout(resolve, PLAYER_SYNC_INTERVAL_MS)
    );
  }

  return {
    playerUrl: null,
    ready: false,
  };
};

const syncJmvstreamPlayerStatus = async (
  lessonId: string
): Promise<{ playerUrl: null | string; status: string }> => {
  try {
    const playerSync = await waitForJmvstreamPlayer(lessonId);

    if (playerSync.ready) {
      return {
        playerUrl: playerSync.playerUrl,
        status: "Video pronto para as alunas.",
      };
    }
  } catch {
    return {
      playerUrl: null,
      status:
        "Processando as qualidades do vídeo na JMVStream (pode levar alguns minutos)...",
    };
  }

  return {
    playerUrl: null,
    status:
      "Processando as qualidades do vídeo na JMVStream (pode levar alguns minutos)...",
  };
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

const getAssetStatusLabel = (uploadStatus: string): string => {
  if (uploadStatus === "ready") {
    return "Player oficial pronto.";
  }

  if (uploadStatus === "processing") {
    return "Processando qualidades e player...";
  }

  if (uploadStatus === "uploading") {
    return "Upload iniciado.";
  }

  if (uploadStatus === "failed") {
    return "Upload falhou.";
  }

  return "Status JMVStream desconhecido.";
};
