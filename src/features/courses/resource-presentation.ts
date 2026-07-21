export interface ResourcePresentationInput {
  contentType?: string | null;
  fileName?: string | null;
  label: string;
  sizeBytes?: number | null;
  storage?: "external" | "r2";
  url?: string | null;
}

interface ResourceTypeLabelOptions {
  presentationLabel?: string;
}

const QUERY_PATTERN = /[?#]/;

export const getResourceExtension = (
  resource: ResourcePresentationInput
): string | null => {
  const source = resource.storage === "r2" ? resource.fileName : resource.url;
  if (!source) {
    return null;
  }
  try {
    const path =
      resource.storage === "external" ? new URL(source).pathname : source;
    const name = path.split(QUERY_PATTERN)[0]?.split("/").pop() ?? "";
    const extension = name.includes(".") ? name.split(".").pop() : null;
    return extension?.trim().toLowerCase() || null;
  } catch {
    return null;
  }
};

export const getResourceTypeLabel = (
  resource: ResourcePresentationInput,
  options: ResourceTypeLabelOptions = {}
): string => {
  if (resource.storage !== "r2") {
    return "Link";
  }
  if (resource.contentType?.startsWith("image/")) {
    return "Imagem";
  }
  const extension = getResourceExtension(resource);
  if (extension === "pdf") {
    return "PDF";
  }
  if (["doc", "docx"].includes(extension ?? "")) {
    return "Documento";
  }
  if (["xls", "xlsx", "csv"].includes(extension ?? "")) {
    return "Planilha";
  }
  if (["ppt", "pptx"].includes(extension ?? "")) {
    return options.presentationLabel ?? "Apresentacao";
  }
  if (extension === "zip") {
    return "Arquivo compactado";
  }
  return "Arquivo";
};

export const formatResourceFileSize = (sizeBytes: number): string =>
  sizeBytes >= 1024 * 1024
    ? `${(sizeBytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(sizeBytes / 1024)).toLocaleString("pt-BR")} KB`;
