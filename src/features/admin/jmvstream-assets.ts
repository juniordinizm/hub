import type { JmvstreamUploadAsset } from "@/components/jmvstream-upload-panel";

interface AdminJmvstreamAsset {
  deleteStatus: JmvstreamUploadAsset["deleteStatus"];
  filename: JmvstreamUploadAsset["filename"];
  galleryUuid: JmvstreamUploadAsset["galleryUuid"];
  id: JmvstreamUploadAsset["id"];
  lastError: JmvstreamUploadAsset["lastError"];
  uploadStatus: JmvstreamUploadAsset["uploadStatus"];
  videoHash: JmvstreamUploadAsset["videoHash"];
}

export const toUploadAsset = (
  asset: AdminJmvstreamAsset
): JmvstreamUploadAsset => ({
  deleteStatus: asset.deleteStatus,
  filename: asset.filename,
  galleryUuid: asset.galleryUuid,
  id: asset.id,
  lastError: asset.lastError,
  uploadStatus: asset.uploadStatus,
  videoHash: asset.videoHash,
});
