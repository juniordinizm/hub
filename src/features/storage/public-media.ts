const PUBLIC_MEDIA_PREFIXES = ["banners/", "courses/"] as const;
const TRAILING_SLASH_PATTERN = /\/$/;

const isPublicMediaKey = (key: string): boolean =>
  PUBLIC_MEDIA_PREFIXES.some((prefix) => key.startsWith(prefix));

export const buildPublicMediaUrl = ({
  baseUrl,
  key,
}: {
  baseUrl: string;
  key: string;
}): string => {
  if (!isPublicMediaKey(key)) {
    throw new Error("Chave de mídia pública inválida.");
  }

  return new URL(
    key,
    `${baseUrl.replace(TRAILING_SLASH_PATTERN, "")}/`
  ).toString();
};
