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

export const resolveLessonVideoFormState = ({
  existingVideo,
  shouldRemoveVideo,
  submittedEmbedUrl,
}: LessonVideoFormInput): LessonVideoFormState => {
  if (shouldRemoveVideo) {
    return {
      hasVideoContent: false,
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
  const hasSubmittedEmbedUrl = Boolean(normalizedSubmittedEmbedUrl);
  const videoEmbedUrl =
    normalizedSubmittedEmbedUrl ?? existingVideo?.embedUrl ?? null;
  const videoExternalId = hasSubmittedEmbedUrl
    ? null
    : (existingVideo?.externalId ?? null);
  const hasVideoContent = Boolean(videoEmbedUrl || videoExternalId);
  const shouldKeepJmvstreamAsset = Boolean(videoExternalId);

  return {
    hasVideoContent,
    shouldKeepJmvstreamAsset,
    videoEmbedUrl,
    videoExternalId,
    videoProvider: hasVideoContent ? "jmvstream" : null,
  };
};
