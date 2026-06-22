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
import {
  recordLessonWatchProgressAction,
  syncJmvstreamLessonDurationAction,
} from "@/app/(student)/app/actions";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
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
  initialWatchedPercent,
  isPreview,
  lessonId,
  title,
  videoEmbedUrl,
  videoProvider,
}: {
  children: React.ReactNode;
  durationSeconds: number;
  initialWatchedPercent: number;
  isPreview: boolean;
  lessonId: string;
  title: string;
  videoEmbedUrl: string | null;
  videoProvider: string | null;
}): React.JSX.Element {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const syncedDurationRef = useRef(durationSeconds);
  const completedByVideoRef = useRef(false);
  const lastWatchProgressSyncRef = useRef({
    percent: initialWatchedPercent,
    syncedAt: 0,
  });
  const [, startTransition] = useTransition();
  const [displayDurationSeconds, setDisplayDurationSeconds] =
    useState(durationSeconds);
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

      if (
        isPreview ||
        !shouldApplyDetectedDuration({
          currentSeconds: syncedDurationRef.current,
          detectedSeconds,
          userEdited: false,
        })
      ) {
        return;
      }

      syncedDurationRef.current = detectedSeconds;
      startTransition(async () => {
        try {
          await syncJmvstreamLessonDurationAction({
            durationSeconds: detectedSeconds,
            lessonId,
          });
        } catch {
          syncedDurationRef.current = displayDurationSeconds;
        }
      });
    },
    [displayDurationSeconds, isPreview, lessonId]
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

          if (!result.completed) {
            return;
          }

          completedByVideoRef.current = true;

          if (result.nextLessonId) {
            router.replace(route(`/app/aulas/${result.nextLessonId}`));
            return;
          }

          router.replace(route(`/app/cursos/${result.courseId}`));
        } catch {
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
        handlePlayerEvent(playerEvent);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleDetectedDuration, handlePlayerEvent, playerOrigin, playerUrl]);

  return (
    <>
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

      <div className="px-5 py-7 sm:px-9">{children}</div>
    </>
  );
}
