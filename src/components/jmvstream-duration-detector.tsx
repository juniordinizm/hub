"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  extractJmvstreamEmbedUrl,
  formatLessonDuration,
  getJmvstreamDurationSecondsFromMessage,
  sanitizeJmvstreamPlayerUrl,
  shouldApplyDetectedDuration,
} from "@/features/videos/jmvstream";

const SYNC_MESSAGE = JSON.stringify({ public_event: "jmvplayer-sync" });
const SYNC_INTERVAL_MS = 1500;

export function JmvstreamDurationDetector({
  defaultEmbedUrl,
  defaultProvider,
  showDetectedMessage = true,
}: {
  defaultEmbedUrl: string;
  defaultProvider: string;
  showDetectedMessage?: boolean;
}): React.JSX.Element | null {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [embedUrl, setEmbedUrl] = useState(defaultEmbedUrl);
  const [provider, setProvider] = useState(defaultProvider);
  const [detectedSeconds, setDetectedSeconds] = useState<number | null>(null);
  const [durationWasEdited, setDurationWasEdited] = useState(false);

  const playerUrl = useMemo(() => {
    if (provider !== "jmvstream") {
      return null;
    }

    return sanitizeJmvstreamPlayerUrl(extractJmvstreamEmbedUrl(embedUrl));
  }, [embedUrl, provider]);

  const syncPlayer = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(SYNC_MESSAGE, "*");
  }, []);

  useEffect(() => {
    const form = rootRef.current?.closest("form");

    if (!form) {
      return;
    }

    const readFields = () => {
      const formData = new FormData(form);
      setEmbedUrl(String(formData.get("videoEmbedUrl") ?? ""));
      setProvider(String(formData.get("videoProvider") ?? defaultProvider));
    };

    const handleInput = (event: Event) => {
      const target = event.target;

      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      if (target.name === "durationSeconds") {
        setDurationWasEdited(true);
      }

      if (target.name === "videoEmbedUrl" || target.name === "videoProvider") {
        readFields();
      }
    };

    form.addEventListener("change", readFields);
    form.addEventListener("input", handleInput);
    readFields();

    return () => {
      form.removeEventListener("change", readFields);
      form.removeEventListener("input", handleInput);
    };
  }, [defaultProvider]);

  useEffect(() => {
    if (!playerUrl) {
      return;
    }

    const interval = window.setInterval(syncPlayer, SYNC_INTERVAL_MS);
    syncPlayer();

    return () => window.clearInterval(interval);
  }, [playerUrl, syncPlayer]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const seconds = getJmvstreamDurationSecondsFromMessage(event.data);

      if (!seconds) {
        return;
      }

      setDetectedSeconds(seconds);

      const form = rootRef.current?.closest("form");
      const durationInput = form?.elements.namedItem("durationSeconds");

      if (!(durationInput instanceof HTMLInputElement)) {
        return;
      }

      const currentSeconds = Number(durationInput.value);

      if (
        !shouldApplyDetectedDuration({
          currentSeconds,
          detectedSeconds: seconds,
          userEdited: durationWasEdited,
        })
      ) {
        return;
      }

      durationInput.value = String(seconds);
      durationInput.dispatchEvent(new Event("input", { bubbles: true }));
      durationInput.dispatchEvent(new Event("change", { bubbles: true }));
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [durationWasEdited]);

  return (
    <div className="flex flex-col gap-2" ref={rootRef}>
      {playerUrl ? (
        <iframe
          className="sr-only"
          ref={iframeRef}
          sandbox="allow-scripts allow-same-origin"
          src={playerUrl}
          title="Detector de duração JMVStream"
        />
      ) : null}
      {detectedSeconds && showDetectedMessage ? (
        <p className="text-muted-foreground text-xs">
          Duração detectada pela JMVStream:{" "}
          {formatLessonDuration(detectedSeconds)}.
        </p>
      ) : null}
    </div>
  );
}
