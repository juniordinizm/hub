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
  videoEmbedUrl: string | null;
  videoExternalId: string | null;
  videoProvider: "jmvstream" | null;
}

export const resolveLessonVideoFormState = ({
  existingVideo,
  shouldRemoveVideo,
  submittedEmbedUrl,
}: LessonVideoFormInput): LessonVideoFormState => {
  if (shouldRemoveVideo) {
    return {
      hasVideoContent: false,
      videoEmbedUrl: null,
      videoExternalId: null,
      videoProvider: null,
    };
  }

  const normalizedSubmittedEmbedUrl = resolveLessonVideoEmbedUrl({
    embedUrl: submittedEmbedUrl,
    provider: "jmvstream",
  });
  const videoEmbedUrl =
    normalizedSubmittedEmbedUrl ?? existingVideo?.embedUrl ?? null;
  const videoExternalId = existingVideo?.externalId ?? null;
  const hasVideoContent = Boolean(videoEmbedUrl || videoExternalId);

  return {
    hasVideoContent,
    videoEmbedUrl,
    videoExternalId,
    videoProvider: hasVideoContent ? "jmvstream" : null,
  };
};
