const JMVSTREAM_PLAYER_HOSTNAME = "player.jmvstream.com";
const IFRAME_SRC_PATTERN = /\bsrc=(["'])(.*?)\1/i;
const VIDEO_PROVIDERS = new Set(["external", "jmvstream", "panda"]);
const JMVSTREAM_OUT_EVENT_PATTERN = /^jmvplayerout-/;
const JMVSTREAM_VIDEO_COMPLETE_PERCENT = 95;

export type VideoProvider = "external" | "jmvstream" | "panda" | null;
export type JmvstreamPlayerEventName =
  | "jmvplayerout-end"
  | "jmvplayerout-pause"
  | "jmvplayerout-play"
  | "jmvplayerout-skip"
  | "jmvplayerout-status";

export interface JmvstreamPlayerEvent {
  currentSeconds: number;
  durationSeconds: number;
  eventName: JmvstreamPlayerEventName;
  watchedPercent: number;
}

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
  const payload = normalizeJmvstreamPayload(message);

  if (!isJmvstreamMessagePayload(payload)) {
    return null;
  }

  return Math.round(payload.duration);
};

export const getJmvstreamPlayerEventFromMessage = (
  message: unknown
): JmvstreamPlayerEvent | null => {
  const payload = normalizeJmvstreamPayload(message);

  if (!isJmvstreamProgressPayload(payload)) {
    return null;
  }

  const eventName = getJmvstreamEventName(payload);

  if (!isJmvstreamPlayerEventName(eventName)) {
    return null;
  }

  const currentSeconds = Math.max(0, Math.round(payload.currentTime));
  const durationSeconds = Math.max(1, Math.round(payload.duration));
  const watchedPercent = Math.min(
    100,
    Math.round((currentSeconds / durationSeconds) * 100)
  );

  return {
    currentSeconds,
    durationSeconds,
    eventName,
    watchedPercent,
  };
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

export const shouldCompleteLessonFromJmvstreamEvent = ({
  eventName,
  watchedPercent,
}: {
  eventName: string;
  watchedPercent: number;
}): boolean =>
  eventName === "jmvplayerout-end" ||
  watchedPercent >= JMVSTREAM_VIDEO_COMPLETE_PERCENT;

const normalizeJmvstreamPayload = (message: unknown): unknown =>
  typeof message === "string" ? parseJmvstreamMessage(message) : message;

const parseJmvstreamMessage = (message: string): unknown => {
  try {
    return JSON.parse(message);
  } catch {
    return null;
  }
};

const isJmvstreamMessagePayload = (
  payload: unknown
): payload is {
  currentTime?: number;
  duration: number;
  event?: string;
  eventName?: string;
} => {
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

const isJmvstreamProgressPayload = (
  payload: unknown
): payload is {
  currentTime: number;
  duration: number;
  event?: string;
  eventName?: string;
} => {
  if (!isJmvstreamMessagePayload(payload)) {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  const rawEventName = getJmvstreamEventName(candidate);

  return (
    isJmvstreamPlayerEventName(rawEventName) &&
    typeof candidate.currentTime === "number" &&
    Number.isFinite(candidate.currentTime) &&
    candidate.currentTime >= 0
  );
};

const getJmvstreamEventName = (payload: {
  event?: unknown;
  eventName?: unknown;
}): unknown =>
  typeof payload.event === "string" ? payload.event : payload.eventName;

const isJmvstreamPlayerEventName = (
  value: unknown
): value is JmvstreamPlayerEventName =>
  value === "jmvplayerout-end" ||
  value === "jmvplayerout-pause" ||
  value === "jmvplayerout-play" ||
  value === "jmvplayerout-skip" ||
  value === "jmvplayerout-status";
