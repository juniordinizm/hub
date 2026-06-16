const JMVSTREAM_PLAYER_HOSTNAME = "player.jmvstream.com";
const IFRAME_SRC_PATTERN = /\bsrc=(["'])(.*?)\1/i;
const VIDEO_PROVIDERS = new Set(["external", "jmvstream", "panda"]);

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
