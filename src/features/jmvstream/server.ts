import "server-only";
import {
  deleteJmvstreamAssetsForLesson as deleteJmvstreamAssetsForLessonCommand,
  retryJmvstreamAssetDelete as retryJmvstreamAssetDeleteCommand,
} from "@/features/jmvstream/asset-deletion";
import {
  discardJmvstreamUpload as discardJmvstreamUploadCommand,
  expireStaleJmvstreamUploads,
  getJmvstreamAssets,
  getJmvstreamAssetsForLesson as getJmvstreamAssetsForLessonQuery,
  markJmvstreamUploadFailed as markJmvstreamUploadFailedCommand,
} from "@/features/jmvstream/asset-persistence";
import { getConfiguredJmvstreamClient } from "@/features/jmvstream/auth";
import {
  countJmvstreamFolders,
  countLocalOrphanJmvstreamFolders,
  ensureJmvstreamCourseFolder as ensureJmvstreamCourseFolderCommand,
} from "@/features/jmvstream/course-folders";
import {
  resolveJmvstreamPlayerThumbnailUrl as resolveJmvstreamPlayerThumbnailUrlQuery,
  syncJmvstreamLessonPlayer as syncJmvstreamLessonPlayerCommand,
  syncPendingJmvstreamPlayers as syncPendingJmvstreamPlayersCommand,
} from "@/features/jmvstream/player-sync";
import { completeJmvstreamUpload as completeJmvstreamUploadCommand } from "@/features/jmvstream/upload-completion";
import { initJmvstreamUpload as initJmvstreamUploadCommand } from "@/features/jmvstream/upload-session";

export type JmvstreamAsset =
  import("@/features/jmvstream/asset-persistence").JmvstreamAsset;
export const completeJmvstreamUpload = (
  ...args: Parameters<typeof completeJmvstreamUploadCommand>
) => completeJmvstreamUploadCommand(...args);
export const deleteJmvstreamAssetsForLesson = (
  ...args: Parameters<typeof deleteJmvstreamAssetsForLessonCommand>
) => deleteJmvstreamAssetsForLessonCommand(...args);
export const discardJmvstreamUpload = (
  ...args: Parameters<typeof discardJmvstreamUploadCommand>
) => discardJmvstreamUploadCommand(...args);
export const ensureJmvstreamCourseFolder = (
  ...args: Parameters<typeof ensureJmvstreamCourseFolderCommand>
) => ensureJmvstreamCourseFolderCommand(...args);
export const getJmvstreamAssetsForLesson = (
  ...args: Parameters<typeof getJmvstreamAssetsForLessonQuery>
) => getJmvstreamAssetsForLessonQuery(...args);
export const initJmvstreamUpload = (
  ...args: Parameters<typeof initJmvstreamUploadCommand>
) => initJmvstreamUploadCommand(...args);
export const markJmvstreamUploadFailed = (
  ...args: Parameters<typeof markJmvstreamUploadFailedCommand>
) => markJmvstreamUploadFailedCommand(...args);
export const resolveJmvstreamPlayerThumbnailUrl = (
  ...args: Parameters<typeof resolveJmvstreamPlayerThumbnailUrlQuery>
) => resolveJmvstreamPlayerThumbnailUrlQuery(...args);
export const retryJmvstreamAssetDelete = (
  ...args: Parameters<typeof retryJmvstreamAssetDeleteCommand>
) => retryJmvstreamAssetDeleteCommand(...args);
export const syncJmvstreamLessonPlayer = (
  ...args: Parameters<typeof syncJmvstreamLessonPlayerCommand>
) => syncJmvstreamLessonPlayerCommand(...args);
export const syncPendingJmvstreamPlayers = (
  ...args: Parameters<typeof syncPendingJmvstreamPlayersCommand>
) => syncPendingJmvstreamPlayersCommand(...args);

export interface JmvstreamHealthSummary {
  auth: "error" | "ok";
  failedDeletes: number;
  failedUploads: number;
  folderCount: number;
  message: string;
  orphanFolders: number;
  pendingDeletes: number;
  processingUploads: number;
}

export const getJmvstreamHealthSummary =
  async (): Promise<JmvstreamHealthSummary> => {
    await expireStaleJmvstreamUploads();
    const assets = await getJmvstreamAssets();
    const failedUploads = countAssetsWithStatus(assets, "uploadStatus", [
      "failed",
    ]);
    const processingUploads = countAssetsWithStatus(assets, "uploadStatus", [
      "processing",
      "uploading",
    ]);
    const failedDeletes = countAssetsWithStatus(assets, "deleteStatus", [
      "failed",
    ]);
    const pendingDeletes = countAssetsWithStatus(assets, "deleteStatus", [
      "pending",
    ]);

    try {
      const folders = await (
        await getConfiguredJmvstreamClient()
      ).listFolders();
      const orphanFolders = await countLocalOrphanJmvstreamFolders(folders);

      return {
        auth: "ok",
        failedDeletes,
        failedUploads,
        folderCount: countJmvstreamFolders(folders),
        message:
          orphanFolders > 0
            ? `JMVStream autenticada; ${orphanFolders} pasta(s) locais nao existem mais na JMVStream e serao recriadas no proximo uso.`
            : "JMVStream autenticada e galerias acessiveis.",
        orphanFolders,
        pendingDeletes,
        processingUploads,
      };
    } catch (error) {
      return {
        auth: "error",
        failedDeletes,
        failedUploads,
        folderCount: 0,
        message:
          error instanceof Error
            ? error.message
            : "Nao foi possivel validar a JMVStream.",
        orphanFolders: 0,
        pendingDeletes,
        processingUploads,
      };
    }
  };

const countAssetsWithStatus = (
  assets: JmvstreamAsset[],
  statusKey: "deleteStatus" | "uploadStatus",
  statuses: string[]
): number =>
  assets.filter((asset) => statuses.includes(asset[statusKey])).length;
