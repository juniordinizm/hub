import "server-only";
import {
  expireStaleJmvstreamUploads,
  getJmvstreamLessonVideo,
  getPendingJmvstreamPlayerLessons,
  markJmvstreamAssetInGallery,
  markJmvstreamAssetMovePending,
  markJmvstreamUploadFailed,
  recordJmvstreamAssetMoveFailure,
  recordJmvstreamReadyPlayer,
  touchJmvstreamProcessingAsset,
} from "@/features/jmvstream/asset-persistence";
import { getConfiguredJmvstreamClient } from "@/features/jmvstream/auth";
import { getJmvstreamThumbnailUrlFromPlayerHtml } from "@/features/jmvstream/client";
import { requireJmvstreamCourseFolder } from "@/features/jmvstream/course-folders";
import {
  getJmvstreamVideoPlacement,
  isJmvstreamVideoNotFoundError,
} from "@/features/jmvstream/provider-mapper";

export interface JmvstreamPlayerSyncResult {
  playerUrl: null | string;
  ready: boolean;
  thumbnailUrl: null | string;
}

export interface JmvstreamPlayerSyncSummary {
  checked: number;
  failed: number;
  pending: number;
  ready: number;
}

export const resolveJmvstreamPlayerThumbnailUrl = async (
  playerUrl: string | null
): Promise<string | null> => {
  if (!playerUrl) {
    return null;
  }

  try {
    const response = await fetch(playerUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!response.ok) {
      return null;
    }

    return getJmvstreamThumbnailUrlFromPlayerHtml(await response.text());
  } catch {
    return null;
  }
};

export const syncJmvstreamLessonPlayer = async (
  lessonId: string
): Promise<JmvstreamPlayerSyncResult> => {
  const lessonVideo = await getJmvstreamLessonVideo(lessonId);

  if (!lessonVideo) {
    return { playerUrl: null, ready: false, thumbnailUrl: null };
  }

  const { courseId, videoHash } = lessonVideo;
  const client = await getConfiguredJmvstreamClient();
  const video = await client.getVideo(videoHash).catch(() => null);
  const playerUrl = video?.playerUrl ?? null;
  const galleryUuid = await requireJmvstreamCourseFolder(courseId);

  await moveJmvstreamVideoToCourseFolder({
    client,
    galleryUuid,
    video,
    videoHash,
  });

  if (!playerUrl) {
    const jobStatus = await client.getVideoJobStatus(videoHash);

    if (jobStatus === "ERROR") {
      await markJmvstreamUploadFailed({
        lastError: "A JMVStream nao conseguiu processar este video.",
        videoHash,
      });
    } else {
      await touchJmvstreamProcessingAsset(videoHash);
    }

    return { playerUrl: null, ready: false, thumbnailUrl: null };
  }

  const thumbnailUrl = await resolveJmvstreamPlayerThumbnailUrl(playerUrl);
  await recordJmvstreamReadyPlayer({
    lessonId,
    playerUrl,
    thumbnailUrl,
    videoHash,
  });

  return { playerUrl, ready: true, thumbnailUrl };
};

export const syncPendingJmvstreamPlayers = async (
  limit = 20
): Promise<JmvstreamPlayerSyncSummary> => {
  await expireStaleJmvstreamUploads();
  const lessonIds = await getPendingJmvstreamPlayerLessons(limit);
  const summary: JmvstreamPlayerSyncSummary = {
    checked: lessonIds.length,
    failed: 0,
    pending: 0,
    ready: 0,
  };

  for (const lessonId of lessonIds) {
    try {
      const result = await syncJmvstreamLessonPlayer(lessonId);

      if (result.ready) {
        summary.ready += 1;
      } else {
        summary.pending += 1;
      }
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
};

export const moveJmvstreamVideoToCourseFolder = async ({
  client,
  galleryUuid,
  video,
  videoHash,
}: {
  client: Awaited<ReturnType<typeof getConfiguredJmvstreamClient>>;
  galleryUuid: string;
  video?: { folderUuid: string | null } | null;
  videoHash: string;
}): Promise<void> => {
  const placement = getJmvstreamVideoPlacement({
    galleryUuid,
    video: video ?? null,
  });

  if (placement === "missing") {
    await markJmvstreamAssetMovePending({ videoHash });
    return;
  }

  if (placement === "already_in_gallery") {
    await markJmvstreamAssetInGallery({ galleryUuid, videoHash });
    return;
  }

  try {
    await client.moveVideo(videoHash, galleryUuid);
    await markJmvstreamAssetInGallery({ galleryUuid, videoHash });
  } catch (error) {
    if (isJmvstreamVideoNotFoundError(error)) {
      await markJmvstreamAssetMovePending({ videoHash });
      return;
    }

    await recordJmvstreamAssetMoveFailure({
      lastError:
        error instanceof Error
          ? `Video pronto, mas ainda nao foi movido para a galeria do curso: ${error.message}`
          : "Video pronto, mas ainda nao foi movido para a galeria do curso.",
      videoHash,
    });
  }
};
