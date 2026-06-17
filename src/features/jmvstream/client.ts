export type JmvstreamUploadType = "direct" | "multipart";

export interface JmvstreamUploadPartInput {
  ETag?: string;
  etag?: string;
  PartNumber?: number;
  partNumber?: number;
}

export interface JmvstreamUploadPart {
  ETag: string;
  PartNumber: number;
}

export interface JmvstreamClientConfig {
  apiBaseUrl: string;
  apiToken: string;
  fetcher?: typeof fetch;
  planId: string;
}

export interface JmvstreamInitUploadInput {
  chunkSize?: number;
  fileName: string;
  fileSize: number;
  galleryUuid: string;
  totalParts?: number;
  uploadType: JmvstreamUploadType;
}

export interface JmvstreamInitUploadResponse {
  objectName: string;
  presignedUrls: Array<string | { partNumber?: number; url: string }>;
  uploadId: string;
  videoHash: string;
}

export interface JmvstreamCompleteUploadInput {
  filename: string;
  galleryUuid: string;
  objectName: string;
  parts: JmvstreamUploadPartInput[];
  size: number;
  uploadId: string;
  videoHash: string;
}

export interface JmvstreamCompleteUploadResponse {
  jobId: string | null;
  message: string | null;
  status: string | null;
  videoHash: string;
}

export interface JmvstreamFolderResponse {
  id?: string | number;
  name: string;
  parentId?: string | number | null;
  uuid: string;
}

type UnknownRecord = Record<string, unknown>;

const TRAILING_SLASH_PATTERN = /\/$/;

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

export class JmvstreamApiError extends Error {
  readonly body: unknown;
  readonly status: number;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "JmvstreamApiError";
    this.status = status;
    this.body = body;
  }
}

export const normalizeJmvstreamApiBaseUrl = (apiBaseUrl: string): string => {
  const url = new URL(apiBaseUrl);
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(TRAILING_SLASH_PATTERN, "");
};

export const normalizeJmvstreamUploadParts = (
  parts: JmvstreamUploadPartInput[]
): JmvstreamUploadPart[] =>
  parts.map((part) => {
    const partNumber = part.PartNumber ?? part.partNumber;
    const etag = part.ETag ?? part.etag;

    if (!(partNumber && etag)) {
      throw new Error("Parte de upload JMVStream invalida.");
    }

    return {
      ETag: etag,
      PartNumber: partNumber,
    };
  });

export const createJmvstreamClient = ({
  apiBaseUrl,
  apiToken,
  fetcher = fetch,
  planId,
}: JmvstreamClientConfig) => {
  const baseUrl = normalizeJmvstreamApiBaseUrl(apiBaseUrl);
  const request = async <ResponseBody>(
    path: string,
    init: RequestInit = {}
  ): Promise<ResponseBody> => {
    const response = await fetcher(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    const responseBody = await readResponseBody(response);

    if (!response.ok) {
      throw new JmvstreamApiError(
        `JMVStream retornou erro ${response.status}.`,
        response.status,
        responseBody
      );
    }

    return responseBody as ResponseBody;
  };

  return {
    completeMultipartUpload: async (
      input: JmvstreamCompleteUploadInput
    ): Promise<JmvstreamCompleteUploadResponse> => {
      const response = await request<UnknownRecord>(
        "/v2/upload/multipart/complete",
        {
          body: JSON.stringify({
            filename: input.filename,
            gallery: input.galleryUuid,
            objectName: input.objectName,
            parts: normalizeJmvstreamUploadParts(input.parts),
            size: input.size,
            uploadId: input.uploadId,
            video_hash: input.videoHash,
          }),
          method: "POST",
        }
      );

      return {
        jobId: readString(response.jobId),
        message: readString(response.message),
        status: readString(response.status),
        videoHash: readString(response.video_hash) ?? input.videoHash,
      };
    },

    createFolder: async ({
      name,
      parentFolderUuid,
    }: {
      name: string;
      parentFolderUuid?: string | null;
    }): Promise<JmvstreamFolderResponse> => {
      const response = await request<UnknownRecord>("/v1/folders", {
        body: JSON.stringify({
          name,
          ...(parentFolderUuid ? { parent_uuid: parentFolderUuid } : {}),
        }),
        method: "POST",
      });

      return parseFolderResponse(response, name);
    },

    deleteVideo: async (videoHash: string): Promise<void> => {
      await request<unknown>(
        `/v1/videos/deleteVideo/${encodeURIComponent(videoHash)}/${encodeURIComponent(planId)}`,
        { method: "DELETE" }
      );
    },

    initMultipartUpload: async (
      input: JmvstreamInitUploadInput
    ): Promise<JmvstreamInitUploadResponse> => {
      const response = await request<UnknownRecord>("/v2/upload/multipart/s3", {
        body: JSON.stringify({
          chunkSize: input.chunkSize,
          fileName: input.fileName,
          fileSize: input.fileSize,
          gallery: input.galleryUuid,
          totalParts: input.totalParts,
          uploadType: input.uploadType,
        }),
        method: "POST",
      });

      return {
        objectName: requireString(response.objectName, "objectName"),
        presignedUrls: parsePresignedUrls(response.presignedUrls),
        uploadId: requireString(response.uploadId, "uploadId"),
        videoHash: requireString(response.video_hash, "video_hash"),
      };
    },

    renameFolder: async ({
      folderUuid,
      name,
    }: {
      folderUuid: string;
      name: string;
    }): Promise<JmvstreamFolderResponse> => {
      const response = await request<UnknownRecord>(
        `/v1/folders/${encodeURIComponent(folderUuid)}`,
        {
          body: JSON.stringify({ name }),
          method: "PUT",
        }
      );

      return parseFolderResponse(response, name, folderUuid);
    },
  };
};

const parsePresignedUrls = (
  value: unknown
): JmvstreamInitUploadResponse["presignedUrls"] => {
  if (!Array.isArray(value)) {
    throw new Error("A resposta da JMVStream nao trouxe URLs de upload.");
  }

  return value.map((item) => {
    if (typeof item === "string") {
      return item;
    }

    if (isRecord(item) && typeof item.url === "string") {
      if (typeof item.partNumber === "number") {
        return {
          partNumber: item.partNumber,
          url: item.url,
        };
      }

      return { url: item.url };
    }

    throw new Error("URL assinada da JMVStream invalida.");
  });
};

const parseFolderResponse = (
  response: UnknownRecord,
  fallbackName: string,
  fallbackUuid?: string
): JmvstreamFolderResponse => {
  const folder: JmvstreamFolderResponse = {
    name: readString(response.name) ?? fallbackName,
    parentId:
      typeof response.parentId === "string" ||
      typeof response.parentId === "number"
        ? response.parentId
        : null,
    uuid:
      readString(response.uuid) ??
      readString(response.folder_uuid) ??
      fallbackUuid ??
      "",
  };

  if (typeof response.id === "string" || typeof response.id === "number") {
    folder.id = response.id;
  }

  return folder;
};

const readResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const requireString = (value: unknown, fieldName: string): string => {
  const stringValue = readString(value);

  if (!stringValue) {
    throw new Error(`Resposta da JMVStream sem ${fieldName}.`);
  }

  return stringValue;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;
