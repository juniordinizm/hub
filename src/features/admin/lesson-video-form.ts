import { resolveLessonVideoEmbedUrl } from "@/features/videos/jmvstream";

interface ExistingLessonVideo {
  embedUrl: string | null;
  externalId: string | null;
}

interface LessonVideoFormInput {
  existingVideo: ExistingLessonVideo | null;
  shouldRemoveVideo: boolean;
  submittedEmbedUrl: string | null;
}

interface LessonVideoFormState {
  hasVideoContent: boolean;
  shouldDeleteJmvstreamAsset: boolean;
  shouldKeepJmvstreamAsset: boolean;
  videoEmbedUrl: string | null;
  videoExternalId: string | null;
  videoProvider: "jmvstream" | null;
}

export type LessonVideoEditorMode = "link" | "upload";

export const getLessonVideoEditorMode = ({
  videoEmbedUrl,
  videoExternalId,
}: {
  videoEmbedUrl: string | null;
  videoExternalId: string | null;
}): LessonVideoEditorMode => {
  if (videoExternalId) {
    return "upload";
  }

  return videoEmbedUrl ? "link" : "upload";
};

export const resolveLessonVideoPreviewUrl = ({
  savedEmbedUrl,
  shouldRemoveVideo,
  submittedEmbedUrl,
}: {
  savedEmbedUrl: string | null;
  shouldRemoveVideo: boolean;
  submittedEmbedUrl: string | null;
}): string | null => {
  if (shouldRemoveVideo) {
    return null;
  }

  return (
    resolveLessonVideoEmbedUrl({
      embedUrl: submittedEmbedUrl,
      provider: "jmvstream",
    }) ??
    resolveLessonVideoEmbedUrl({
      embedUrl: savedEmbedUrl,
      provider: "jmvstream",
    })
  );
};

export const resolveLessonVideoFormState = ({
  existingVideo,
  shouldRemoveVideo,
  submittedEmbedUrl,
}: LessonVideoFormInput): LessonVideoFormState => {
  if (shouldRemoveVideo) {
    return {
      hasVideoContent: false,
      shouldDeleteJmvstreamAsset: Boolean(existingVideo?.externalId),
      shouldKeepJmvstreamAsset: false,
      videoEmbedUrl: null,
      videoExternalId: null,
      videoProvider: null,
    };
  }

  const normalizedSubmittedEmbedUrl = resolveLessonVideoEmbedUrl({
    embedUrl: submittedEmbedUrl,
    provider: "jmvstream",
  });
  const isExistingUrl =
    Boolean(existingVideo?.embedUrl) &&
    normalizedSubmittedEmbedUrl === existingVideo?.embedUrl;
  const hasManualLink = Boolean(normalizedSubmittedEmbedUrl) && !isExistingUrl;

  const videoEmbedUrl =
    normalizedSubmittedEmbedUrl ?? existingVideo?.embedUrl ?? null;
  const videoExternalId = hasManualLink
    ? null
    : (existingVideo?.externalId ?? null);
  const hasVideoContent = Boolean(videoEmbedUrl || videoExternalId);
  const shouldDeleteJmvstreamAsset = Boolean(
    existingVideo?.externalId && hasManualLink
  );
  const shouldKeepJmvstreamAsset = Boolean(videoExternalId);

  return {
    hasVideoContent,
    shouldDeleteJmvstreamAsset,
    shouldKeepJmvstreamAsset,
    videoEmbedUrl,
    videoExternalId,
    videoProvider: hasVideoContent ? "jmvstream" : null,
  };
};
