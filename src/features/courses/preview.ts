import type { AppRole } from "@/lib/session";

export type StudentPreviewMode = "student";

export const isPreviewRole = (role: AppRole): boolean =>
  role === "admin" || role === "support";

export const getStudentPreviewMode = ({
  preview,
  role,
}: {
  preview: string | string[] | undefined;
  role: AppRole;
}): StudentPreviewMode | null => {
  const previewValue = Array.isArray(preview) ? preview[0] : preview;

  if (
    isPreviewRole(role) &&
    (previewValue === "student" || previewValue === "aluno")
  ) {
    return "student";
  }

  return null;
};

export const getPreviewAwareHref = (
  href: string,
  previewMode: StudentPreviewMode | null
): string => {
  if (!previewMode) {
    return href;
  }

  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}preview=${previewMode}`;
};

export const getHrefWithSearchParams = (
  href: string,
  params: Record<string, string | null | undefined>
): string => {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  );

  if (entries.length === 0) {
    return href;
  }

  const searchParams = new URLSearchParams(entries);
  const separator = href.includes("?") ? "&" : "?";

  return `${href}${separator}${searchParams.toString()}`;
};
