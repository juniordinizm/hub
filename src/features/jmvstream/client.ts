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
  playerUrl: string | null;
  status: string | null;
  videoHash: string;
}

export interface JmvstreamFolderResponse {
  children?: JmvstreamFolderResponse[];
  description?: string | null;
  id?: string | number;
  name: string;
  parentId?: string | number | null;
  uuid: string;
}

export interface JmvstreamVideoResponse {
  folderUuid: string | null;
  hash: string;
  name: string;
  playerUrl: string | null;
  status: string | null;
}

type UnknownRecord = Record<string, unknown>;

const TRAILING_SLASH_PATTERN = /\/$/;
const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IFRAME_SRC_PATTERN = /\bsrc\s*=\s*['"]([^'"]+)['"]/i;
const JMVSTREAM_PLAYER_HOSTNAME = "player.jmvstream.com";
const JWT_REFRESH_WINDOW_SECONDS = 60;

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const normalizeFolderName = (name: string): string =>
  name.trim().toLocaleLowerCase();

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

export const isJmvstreamJwtUsable = (
  token: string | null | undefined,
  now = new Date()
): boolean => {
  if (!token) {
    return false;
  }

  const payload = decodeJwtPayload(token);
  const expiresAt = typeof payload?.exp === "number" ? payload.exp : null;

  if (!expiresAt) {
    return false;
  }

  const safeNowSeconds =
    Math.floor(now.getTime() / 1000) + JWT_REFRESH_WINDOW_SECONDS;

  return expiresAt > safeNowSeconds;
};

export const authenticateJmvstreamApi = async ({
  apiBaseUrl,
  email,
  fetcher = fetch,
  password,
  resource,
}: {
  apiBaseUrl: string;
  email: string;
  fetcher?: typeof fetch;
  password: string;
  resource: string;
}): Promise<string> => {
  assertValidJmvstreamResource(resource);
  const baseUrl = normalizeJmvstreamApiBaseUrl(apiBaseUrl);
  const response = await fetcher(`${baseUrl}/v1/authenticate`, {
    body: JSON.stringify({ email, password, resource }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const responseBody = await readResponseBody(response);

  if (!response.ok) {
    throw new JmvstreamApiError(
      createJmvstreamApiErrorMessage(response.status, responseBody),
      response.status,
      responseBody
    );
  }

  return requireString(
    isRecord(responseBody) ? responseBody.token : null,
    "token"
  );
};

export const assertValidJmvstreamResource = (resource: string): void => {
  if (GUID_PATTERN.test(resource.trim())) {
    return;
  }

  const jwtPayload = decodeJwtPayload(resource);
  const planUuid =
    jwtPayload && typeof jwtPayload.planUuid === "string"
      ? jwtPayload.planUuid
      : null;

  throw new Error(
    planUuid
      ? `JMVSTREAM_AUTH_RESOURCE precisa ser o UUID do recurso/aplicacao da JMVStream, nao o JWT. Use o planUuid do token: ${planUuid}.`
      : "JMVSTREAM_AUTH_RESOURCE precisa ser o UUID do recurso/aplicacao da JMVStream."
  );
};

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
  parts
    .map((part) => {
      const partNumber = part.PartNumber ?? part.partNumber;
      const etag = part.ETag ?? part.etag;

      if (!(partNumber && etag?.trim())) {
        throw new Error("Parte de upload JMVStream invalida.");
      }

      return {
        ETag: etag,
        PartNumber: partNumber,
      };
    })
    .sort((left, right) => left.PartNumber - right.PartNumber);

export const findJmvstreamFolderByName = (
  folders: JmvstreamFolderResponse[],
  name: string
): JmvstreamFolderResponse | null => {
  const normalizedName = normalizeFolderName(name);

  for (const folder of folders) {
    if (normalizeFolderName(folder.name) === normalizedName) {
      return folder;
    }

    const child = findJmvstreamFolderByName(folder.children ?? [], name);

    if (child) {
      return child;
    }
  }

  return null;
};

export const findJmvstreamVideoByHash = (
  videos: JmvstreamVideoResponse[],
  videoHash: string
): JmvstreamVideoResponse | null =>
  videos.find((video) => video.hash === videoHash) ?? null;

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
        createJmvstreamApiErrorMessage(response.status, responseBody),
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
        playerUrl: readOfficialJmvstreamPlayerUrl(response),
        status: readString(response.status),
        videoHash: readString(response.video_hash) ?? input.videoHash,
      };
    },

    createFolder: async ({
      name,
    }: {
      name: string;
      parentFolderUuid?: string | null;
    }): Promise<JmvstreamFolderResponse> => {
      const response = await request<UnknownRecord>("/v1/folders", {
        body: JSON.stringify({
          name,
        }),
        method: "POST",
      });
      const folder = parseFolderResponse(response, name);

      if (folder.uuid) {
        return folder;
      }

      const foldersResponse = await request<UnknownRecord>("/v1/folders", {
        method: "GET",
      });
      const folders = Array.isArray(foldersResponse.folders)
        ? foldersResponse.folders.map((item) => parseFolderTreeResponse(item))
        : [];
      const createdFolder = findJmvstreamFolderByName(folders, name);

      if (createdFolder?.uuid) {
        return createdFolder;
      }

      throw new Error("Resposta da JMVStream sem uuid da pasta.");
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

    listFolders: async (): Promise<JmvstreamFolderResponse[]> => {
      const response = await request<UnknownRecord>("/v1/folders", {
        method: "GET",
      });

      const folders = Array.isArray(response.folders) ? response.folders : [];

      return folders.map((folder) => parseFolderTreeResponse(folder));
    },

    listVideos: async (): Promise<JmvstreamVideoResponse[]> => {
      const response = await request<UnknownRecord>("/v1/videos/application", {
        method: "GET",
      });

      const videos = Array.isArray(response.videos) ? response.videos : [];

      return videos.map((video) => parseVideoResponse(video));
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

const parseVideoResponse = (value: unknown): JmvstreamVideoResponse => {
  if (!isRecord(value)) {
    throw new Error("Video JMVStream invalido.");
  }

  return {
    folderUuid: readString(value.folder_uuid),
    hash: requireString(value.hash, "hash"),
    name: readString(value.name) ?? "Sem nome",
    playerUrl: readOfficialJmvstreamPlayerUrl(value),
    status: readString(value.status),
  };
};

const parseFolderTreeResponse = (value: unknown): JmvstreamFolderResponse => {
  if (!isRecord(value)) {
    throw new Error("Pasta JMVStream invalida.");
  }

  const folder = parseFolderResponse(value, "Sem nome");
  const childrenValue = Array.isArray(value.children)
    ? value.children
    : value.subFolders;
  const children = Array.isArray(childrenValue)
    ? childrenValue.map((child) => parseFolderTreeResponse(child))
    : [];

  return {
    ...folder,
    ...(readString(value.description)
      ? { description: readString(value.description) }
      : {}),
    children,
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

const createJmvstreamApiErrorMessage = (
  status: number,
  body: unknown
): string => {
  const message = getJmvstreamApiErrorMessage(body);

  if (message) {
    return message;
  }

  const bodySummary = getJmvstreamApiBodySummary(body);

  if (bodySummary) {
    return `JMVStream retornou erro ${status}: ${bodySummary}`;
  }

  return `JMVStream retornou erro ${status}.`;
};

const getJmvstreamApiErrorMessage = (body: unknown): string | null => {
  if (!isRecord(body)) {
    return null;
  }

  return (
    readString(body.message) ??
    readString(body.error) ??
    (isRecord(body.error) ? readString(body.error.message) : null)
  );
};

const getJmvstreamApiBodySummary = (body: unknown): string | null => {
  let summary = "";

  if (typeof body === "string") {
    summary = body;
  } else if (isRecord(body)) {
    summary = JSON.stringify(body);
  }

  const trimmed = summary.trim();

  if (!trimmed || trimmed === "{}") {
    return null;
  }

  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed;
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

const decodeJwtPayload = (token: string): UnknownRecord | null => {
  const [, encodedPayload] = token.split(".");

  if (!encodedPayload) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString());
  } catch {
    return null;
  }
};

const readOfficialJmvstreamPlayerUrl = (
  response: UnknownRecord
): string | null => {
  const candidates = [
    response.player_url,
    response.playerUrl,
    response.playerSource,
    response.embed_url,
    response.embedUrl,
    response.url,
    readIframeSrc(readString(response.player)),
  ];

  for (const candidate of candidates) {
    const url = readString(candidate);

    if (url && isOfficialJmvstreamPlayerUrl(url)) {
      return url;
    }
  }

  return null;
};

const readIframeSrc = (html: string | null): string | null => {
  if (!html) {
    return null;
  }

  const match = html.match(IFRAME_SRC_PATTERN);
  return match?.[1] ?? null;
};

const isOfficialJmvstreamPlayerUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" && url.hostname === JMVSTREAM_PLAYER_HOSTNAME
    );
  } catch {
    return false;
  }
};
