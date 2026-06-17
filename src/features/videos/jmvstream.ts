const JMVSTREAM_PLAYER_HOSTNAME = "player.jmvstream.com";
const IFRAME_SRC_PATTERN = /\bsrc=(["'])(.*?)\1/i;
const VIDEO_PROVIDERS = new Set(["external", "jmvstream", "panda"]);
const JMVSTREAM_OUT_EVENT_PATTERN = /^jmvplayerout-/;

export type VideoProvider = "external" | "jmvstream" | "panda" | null;

export const toVideoProvider = (value: string | null): VideoProvider =>
  value && VIDEO_PROVIDERS.has(value)
    ? (value as Exclude<VideoProvider, null>)
    : null;

export const isJmvstreamPlayerUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" && url.hostname === JMVSTREAM_PLAYER_HOSTNAME
    );
  } catch {
    return false;
  }
};

export const extractJmvstreamEmbedUrl = (
  value: string | null
): string | null => {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  const iframeSrc = IFRAME_SRC_PATTERN.exec(trimmedValue)?.[2];
  const candidate = iframeSrc ?? trimmedValue;

  return isJmvstreamPlayerUrl(candidate) ? candidate : null;
};

export const resolveLessonVideoEmbedUrl = ({
  embedUrl,
  provider,
}: {
  embedUrl: string | null;
  provider: VideoProvider;
}): string | null => {
  if (!embedUrl) {
    return null;
  }

  if (provider === "jmvstream") {
    return extractJmvstreamEmbedUrl(embedUrl);
  }

  return embedUrl.trim() || null;
};

export const getJmvstreamDurationSecondsFromMessage = (
  message: unknown
): number | null => {
  const payload =
    typeof message === "string" ? parseJmvstreamMessage(message) : message;

  if (!isJmvstreamDurationPayload(payload)) {
    return null;
  }

  return Math.round(payload.duration);
};

export const formatLessonDuration = (durationSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.round(durationSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  if (minutes > 0 && seconds > 0) {
    return `${minutes} min ${seconds} s`;
  }

  if (minutes > 0) {
    return `${minutes} min`;
  }

  return `${seconds} s`;
};

export const shouldApplyDetectedDuration = ({
  currentSeconds,
  detectedSeconds,
  userEdited,
}: {
  currentSeconds: number;
  detectedSeconds: number;
  userEdited: boolean;
}): boolean =>
  !userEdited &&
  Number.isFinite(detectedSeconds) &&
  detectedSeconds > 0 &&
  Math.round(currentSeconds) !== Math.round(detectedSeconds);

const parseJmvstreamMessage = (message: string): unknown => {
  try {
    return JSON.parse(message);
  } catch {
    return null;
  }
};

const isJmvstreamDurationPayload = (
  payload: unknown
): payload is { duration: number; event?: string; eventName?: string } => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  const eventName =
    typeof candidate.event === "string" ? candidate.event : candidate.eventName;

  return (
    typeof eventName === "string" &&
    JMVSTREAM_OUT_EVENT_PATTERN.test(eventName) &&
    typeof candidate.duration === "number" &&
    Number.isFinite(candidate.duration) &&
    candidate.duration > 0
  );
};
