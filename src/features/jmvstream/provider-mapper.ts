export type JmvstreamVideoPlacement = "already_in_gallery" | "missing" | "move";

export const getJmvstreamVideoPlacement = ({
  galleryUuid,
  video,
}: {
  galleryUuid: string;
  video?: { folderUuid: string | null } | null;
}): JmvstreamVideoPlacement => {
  if (!video) {
    return "missing";
  }

  return video.folderUuid === galleryUuid ? "already_in_gallery" : "move";
};

export const isJmvstreamVideoNotFoundError = (error: unknown): boolean =>
  error instanceof Error &&
  error.message.trim().toLocaleLowerCase() === "video not found";
