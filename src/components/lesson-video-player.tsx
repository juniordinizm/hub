"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { syncJmvstreamLessonDurationAction } from "@/app/(student)/app/actions";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import {
  extractJmvstreamEmbedUrl,
  formatLessonDuration,
  getJmvstreamDurationSecondsFromMessage,
  shouldApplyDetectedDuration,
} from "@/features/videos/jmvstream";

const SYNC_MESSAGE = JSON.stringify({ public_event: "jmvplayer-sync" });
const SYNC_INTERVAL_MS = 1500;

export function LessonVideoPlayer({
  children,
  durationSeconds,
  lessonId,
  progressPercent,
  title,
  videoEmbedUrl,
  videoProvider,
}: {
  children: React.ReactNode;
  durationSeconds: number;
  lessonId: string;
  progressPercent: number;
  title: string;
  videoEmbedUrl: string | null;
  videoProvider: string | null;
}): React.JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const syncedDurationRef = useRef(durationSeconds);
  const [, startTransition] = useTransition();
  const [displayDurationSeconds, setDisplayDurationSeconds] =
    useState(durationSeconds);
  const playerUrl = useMemo(() => {
    if (!(videoEmbedUrl && videoProvider === "jmvstream")) {
      return null;
    }

    return extractJmvstreamEmbedUrl(videoEmbedUrl);
  }, [videoEmbedUrl, videoProvider]);
  const iframeSrc = playerUrl ?? videoEmbedUrl;

  const syncPlayer = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(SYNC_MESSAGE, "*");
  }, []);

  useEffect(() => {
    if (!playerUrl) {
      return;
    }

    const interval = window.setInterval(syncPlayer, SYNC_INTERVAL_MS);
    syncPlayer();

    return () => window.clearInterval(interval);
  }, [playerUrl, syncPlayer]);

  useEffect(() => {
    if (!playerUrl) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const detectedSeconds = getJmvstreamDurationSecondsFromMessage(
        event.data
      );

      if (
        !(
          detectedSeconds &&
          shouldApplyDetectedDuration({
            currentSeconds: displayDurationSeconds,
            detectedSeconds,
            userEdited: false,
          })
        )
      ) {
        return;
      }

      setDisplayDurationSeconds(detectedSeconds);

      if (
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
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [displayDurationSeconds, lessonId, playerUrl]);

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

      <div className="px-5 py-7 sm:px-9">
        <Badge
          className="border-primary/30 bg-primary/15 text-primary"
          variant="outline"
        >
          {formatLessonDuration(displayDurationSeconds)} · {progressPercent}% do
          curso
        </Badge>
        {children}
      </div>
    </>
  );
}
