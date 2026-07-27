import {
  MAX_CERTIFICATE_BACKGROUND_BYTES,
  MAX_CERTIFICATE_SIGNATURE_BYTES,
} from "@/features/certificates/template-image-contract";
import { MAX_BANNER_BYTES } from "@/features/storage/banner-image";
import { MAX_ORIGINAL_COVER_BYTES } from "@/features/storage/course-cover";
import { sanitizeR2FileName } from "@/features/storage/r2-objects";

export const STAGED_ADMIN_IMAGE_PREFIX = "uploads/admin-images";

const STAGED_ADMIN_IMAGE_CATALOG = {
  "certificate-background": {
    aggregateType: "certificate-template",
    maxBytes: MAX_CERTIFICATE_BACKGROUND_BYTES,
  },
  "certificate-signature": {
    aggregateType: "certificate-template",
    maxBytes: MAX_CERTIFICATE_SIGNATURE_BYTES,
  },
  "course-cover": {
    aggregateType: "course",
    maxBytes: MAX_ORIGINAL_COVER_BYTES,
  },
  "dashboard-banner": {
    aggregateType: "dashboard-banner",
    maxBytes: MAX_BANNER_BYTES,
  },
} as const;

export type StagedAdminImagePurpose = keyof typeof STAGED_ADMIN_IMAGE_CATALOG;
export type StagedAdminImageAggregateType =
  (typeof STAGED_ADMIN_IMAGE_CATALOG)[StagedAdminImagePurpose]["aggregateType"];

export interface StagedAdminImageReference {
  aggregateId: string;
  contentType: string;
  fileName: string;
  key: string;
  purpose: StagedAdminImagePurpose;
  sizeBytes: number;
}

const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const STAGED_ADMIN_IMAGE_PURPOSES = new Set<StagedAdminImagePurpose>(
  Object.keys(STAGED_ADMIN_IMAGE_CATALOG) as StagedAdminImagePurpose[]
);
const SAFE_PATH_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const assertSafePathSegment = (value: string): void => {
  if (!(value && SAFE_PATH_SEGMENT_PATTERN.test(value))) {
    throw new Error("Upload temporario invalido.");
  }
};

export const buildStagedAdminImageUpload = ({
  actorUserId,
  aggregateId,
  contentType,
  fileName,
  nonce,
  purpose,
  sizeBytes,
}: {
  actorUserId: string;
  aggregateId: string;
  contentType: string;
  fileName: string;
  nonce: string;
  purpose: StagedAdminImagePurpose;
  sizeBytes: number;
}): StagedAdminImageReference => {
  assertSafePathSegment(actorUserId);
  assertSafePathSegment(nonce);
  if (!UUID_PATTERN.test(aggregateId)) {
    throw new Error("Destino de upload invalido.");
  }

  if (!ALLOWED_IMAGE_CONTENT_TYPES.has(contentType)) {
    throw new Error("Envie uma imagem JPG, PNG ou WebP.");
  }
  if (!(Number.isInteger(sizeBytes) && sizeBytes > 0)) {
    throw new Error("Tamanho de imagem invalido.");
  }
  const catalogEntry = STAGED_ADMIN_IMAGE_CATALOG[purpose];
  if (!catalogEntry || sizeBytes > catalogEntry.maxBytes) {
    throw new Error("A imagem excede o limite permitido.");
  }

  const sanitizedFileName = sanitizeR2FileName(fileName);
  if (!sanitizedFileName) {
    throw new Error("Nome de imagem invalido.");
  }

  return {
    aggregateId,
    contentType,
    fileName,
    key: `${STAGED_ADMIN_IMAGE_PREFIX}/${actorUserId}/${catalogEntry.aggregateType}/${aggregateId}/${purpose}/${nonce}-${sanitizedFileName}`,
    purpose,
    sizeBytes,
  };
};

export const assertStagedAdminImageOwnership = ({
  actorUserId,
  aggregateId,
  purpose,
  reference,
}: {
  actorUserId: string;
  aggregateId: string;
  purpose: StagedAdminImagePurpose;
  reference: StagedAdminImageReference;
}): void => {
  const aggregateType = STAGED_ADMIN_IMAGE_CATALOG[purpose].aggregateType;
  const expectedPrefix = `${STAGED_ADMIN_IMAGE_PREFIX}/${actorUserId}/${aggregateType}/${aggregateId}/${purpose}/`;

  if (
    reference.aggregateId !== aggregateId ||
    reference.purpose !== purpose ||
    !reference.key.startsWith(expectedPrefix)
  ) {
    throw new Error("Upload temporario invalido.");
  }
};

export const parseStagedAdminImageReference = (
  value: unknown
): StagedAdminImageReference | null => {
  if (!isRecord(value)) {
    return null;
  }

  const { aggregateId, contentType, fileName, key, purpose, sizeBytes } = value;
  if (
    typeof aggregateId !== "string" ||
    typeof contentType !== "string" ||
    typeof fileName !== "string" ||
    typeof key !== "string" ||
    typeof purpose !== "string" ||
    !STAGED_ADMIN_IMAGE_PURPOSES.has(purpose as StagedAdminImagePurpose) ||
    !(typeof sizeBytes === "number" && Number.isInteger(sizeBytes))
  ) {
    return null;
  }

  try {
    const reference = buildStagedAdminImageUpload({
      actorUserId: key.split("/")[2] ?? "",
      aggregateId,
      contentType,
      fileName,
      nonce: "validation",
      purpose: purpose as StagedAdminImagePurpose,
      sizeBytes,
    });

    return {
      ...reference,
      key,
    };
  } catch {
    return null;
  }
};

export const isStagedAdminImagePurpose = (
  value: string
): value is StagedAdminImagePurpose =>
  STAGED_ADMIN_IMAGE_PURPOSES.has(value as StagedAdminImagePurpose);

export const getStagedAdminImageAggregateType = (
  purpose: StagedAdminImagePurpose
): StagedAdminImageAggregateType =>
  STAGED_ADMIN_IMAGE_CATALOG[purpose].aggregateType;
