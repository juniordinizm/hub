"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { recordLessonWatchProgressAction } from "@/app/(student)/app/actions";
import { LessonFocusContainer } from "@/components/lesson-focus-mode";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  createJmvstreamPlayerJumpMessage,
  extractJmvstreamEmbedUrl,
  getJmvstreamDurationSecondsFromMessage,
  getJmvstreamPlayerEventFromMessage,
  type JmvstreamPlayerEvent,
  shouldApplyDetectedDuration,
} from "@/features/videos/jmvstream";
import { route } from "@/lib/routes";

const SYNC_MESSAGE = JSON.stringify({ public_event: "jmvplayer-sync" });
const SYNC_INTERVAL_MS = 1500;
const WATCH_PROGRESS_INTERVAL_MS = 10_000;
const WATCH_PROGRESS_PERCENT_STEP = 5;

export function LessonVideoPlayer({
  children,
  durationSeconds,
  initialPositionSeconds,
  initialWatchedPercent,
  isPreview,
  lessonId,
  title,
  videoEmbedUrl,
  videoProvider,
}: {
  children: React.ReactNode;
  durationSeconds: number;
  initialPositionSeconds: number;
  initialWatchedPercent: number;
  isPreview: boolean;
  lessonId: string;
  title: string;
  videoEmbedUrl: string | null;
  videoProvider: string | null;
}): React.JSX.Element {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const completedByVideoRef = useRef(false);
  const hasRestoredPositionRef = useRef(false);
  const isRestoringPositionRef = useRef(false);
  const lastWatchProgressSyncRef = useRef({
    percent: initialWatchedPercent,
    syncedAt: 0,
  });
  const [, startTransition] = useTransition();
  const [displayDurationSeconds, setDisplayDurationSeconds] =
    useState(durationSeconds);
  const [progressSaveError, setProgressSaveError] = useState(false);
  const [watchedPercent, setWatchedPercent] = useState(initialWatchedPercent);
  const playerUrl = useMemo(() => {
    if (!(videoEmbedUrl && videoProvider === "jmvstream")) {
      return null;
    }

    return extractJmvstreamEmbedUrl(videoEmbedUrl);
  }, [videoEmbedUrl, videoProvider]);
  const iframeSrc = playerUrl ?? videoEmbedUrl;
  const playerOrigin = useMemo(() => {
    if (!playerUrl) {
      return null;
    }

    return new URL(playerUrl).origin;
  }, [playerUrl]);

  const syncPlayer = useCallback(() => {
    if (!playerOrigin) {
      return;
    }

    iframeRef.current?.contentWindow?.postMessage(SYNC_MESSAGE, playerOrigin);
  }, [playerOrigin]);

  const restorePlayerPosition = useCallback(() => {
    if (hasRestoredPositionRef.current || !playerOrigin) {
      return;
    }

    const jumpMessage = createJmvstreamPlayerJumpMessage(
      initialPositionSeconds
    );
    if (!jumpMessage) {
      return;
    }

    iframeRef.current?.contentWindow?.postMessage(jumpMessage, playerOrigin);
    hasRestoredPositionRef.current = true;
    isRestoringPositionRef.current = true;
  }, [initialPositionSeconds, playerOrigin]);

  const handleDetectedDuration = useCallback(
    (detectedSeconds: number) => {
      if (
        shouldApplyDetectedDuration({
          currentSeconds: displayDurationSeconds,
          detectedSeconds,
          userEdited: false,
        })
      ) {
        setDisplayDurationSeconds(detectedSeconds);
      }
    },
    [displayDurationSeconds]
  );

  const handlePlayerEvent = useCallback(
    (playerEvent: JmvstreamPlayerEvent) => {
      const now = Date.now();
      if (isPreview) {
        setWatchedPercent((currentPercent) =>
          Math.max(currentPercent, playerEvent.watchedPercent)
        );
        return;
      }

      const shouldSyncWatchProgress =
        playerEvent.eventName === "jmvplayerout-end" ||
        now - lastWatchProgressSyncRef.current.syncedAt >=
          WATCH_PROGRESS_INTERVAL_MS ||
        playerEvent.watchedPercent - lastWatchProgressSyncRef.current.percent >=
          WATCH_PROGRESS_PERCENT_STEP;

      if (!shouldSyncWatchProgress || completedByVideoRef.current) {
        return;
      }

      lastWatchProgressSyncRef.current = {
        percent: playerEvent.watchedPercent,
        syncedAt: now,
      };

      startTransition(async () => {
        try {
          const result = await recordLessonWatchProgressAction({
            currentSeconds: playerEvent.currentSeconds,
            durationSeconds: playerEvent.durationSeconds,
            eventName: playerEvent.eventName,
            lessonId,
          });

          setWatchedPercent((currentPercent) =>
            Math.max(currentPercent, result.watchedPercent)
          );
          setProgressSaveError(false);

          if (!result.completed) {
            return;
          }

          const isVideoEnded = playerEvent.eventName === "jmvplayerout-end";

          if (isVideoEnded) {
            completedByVideoRef.current = true;

            if (result.nextLessonId) {
              router.replace(route(`/app/aulas/${result.nextLessonId}`));
              return;
            }

            router.replace(route(`/app/cursos/${result.courseId}`));
          } else if (!completedByVideoRef.current) {
            router.refresh();
          }
        } catch {
          setProgressSaveError(true);
          lastWatchProgressSyncRef.current = {
            percent: watchedPercent,
            syncedAt: 0,
          };
        }
      });
    },
    [isPreview, lessonId, router, watchedPercent]
  );

  useEffect(() => {
    if (!playerUrl) {
      return;
    }

    const interval = window.setInterval(syncPlayer, SYNC_INTERVAL_MS);
    syncPlayer();

    return () => window.clearInterval(interval);
  }, [playerUrl, syncPlayer]);

  useEffect(() => {
    if (!(playerOrigin && playerUrl)) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (
        event.source !== iframeRef.current?.contentWindow ||
        event.origin !== playerOrigin
      ) {
        return;
      }

      const detectedSeconds = getJmvstreamDurationSecondsFromMessage(
        event.data
      );
      const playerEvent = getJmvstreamPlayerEventFromMessage(event.data);

      if (detectedSeconds) {
        handleDetectedDuration(detectedSeconds);
      }

      if (playerEvent) {
        restorePlayerPosition();
        if (isRestoringPositionRef.current) {
          isRestoringPositionRef.current = false;
          return;
        }

        handlePlayerEvent(playerEvent);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    handleDetectedDuration,
    handlePlayerEvent,
    playerOrigin,
    playerUrl,
    restorePlayerPosition,
  ]);

  return (
    <>
      <LessonFocusContainer>
        <AspectRatio className="overflow-hidden bg-black" ratio={16 / 9}>
          {iframeSrc ? (
            <iframe
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
              ref={iframeRef}
              referrerPolicy="strict-origin-when-cross-origin"
              src={iframeSrc}
              title={title}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-muted-foreground">
              Vídeo em configuração
            </div>
          )}
        </AspectRatio>
      </LessonFocusContainer>

      <p aria-live="polite" className="sr-only" role="status">
        {progressSaveError
          ? "Não foi possível salvar o progresso agora. Continuaremos tentando enquanto você assiste."
          : ""}
      </p>

      {children}
    </>
  );
}
