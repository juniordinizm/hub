import "server-only";
import { getPool } from "@/db";
import type {
  LessonResourceUploadReference,
  LessonResourceUploadSession,
  LessonResourceUploadStatus,
} from "@/features/storage/lesson-resource-upload";

interface QueryResult<Row> {
  rowCount: number | null;
  rows: Row[];
}

export interface LessonResourceUploadQueryable {
  query: <Row = Record<string, unknown>>(
    sql: string,
    values?: unknown[]
  ) => Promise<QueryResult<Row>>;
}

interface LessonResourceUploadRow {
  actor_user_id: string;
  content_type: string;
  expires_at: Date | string;
  file_name: string;
  lesson_id: string;
  object_key: string;
  preview_content_type: string | null;
  preview_height: number | null;
  preview_key: string | null;
  preview_size_bytes: number | null;
  preview_width: number | null;
  resource_id: string;
  size_bytes: number;
  status: LessonResourceUploadStatus;
}

const getQueryable = (
  queryable?: LessonResourceUploadQueryable
): LessonResourceUploadQueryable => queryable ?? getPool();

const assertMutation = (rowCount: number | null): void => {
  if (rowCount !== 1) {
    throw new Error("O upload temporario ja foi utilizado ou expirou.");
  }
};

const toDate = (value: Date | string): Date =>
  value instanceof Date ? value : new Date(value);

const assertStoredReferenceIsSafe = (row: LessonResourceUploadRow): void => {
  const lessonPrefix = `lessons/${row.lesson_id}/resources/`;
  const hasPreviewFields = [
    row.preview_content_type,
    row.preview_height,
    row.preview_key,
    row.preview_size_bytes,
    row.preview_width,
  ].some((value) => value !== null);
  const hasCompletePreview =
    row.preview_content_type === "image/webp" &&
    typeof row.preview_height === "number" &&
    row.preview_height > 0 &&
    typeof row.preview_key === "string" &&
    row.preview_key.startsWith(lessonPrefix) &&
    typeof row.preview_size_bytes === "number" &&
    row.preview_size_bytes > 0 &&
    typeof row.preview_width === "number" &&
    row.preview_width > 0;

  if (
    !row.object_key.startsWith(lessonPrefix) ||
    (hasPreviewFields && !hasCompletePreview)
  ) {
    throw new Error("Upload temporario invalido.");
  }
};

const toReference = (
  row: LessonResourceUploadRow
): LessonResourceUploadReference => {
  assertStoredReferenceIsSafe(row);
  const hasPreview = Boolean(
    row.preview_key &&
      row.preview_content_type &&
      row.preview_height &&
      row.preview_size_bytes &&
      row.preview_width
  );

  return {
    contentType: row.content_type,
    fileName: row.file_name,
    id: row.resource_id,
    key: row.object_key,
    label: row.file_name,
    ...(hasPreview
      ? {
          preview: {
            contentType: "image/webp",
            height: row.preview_height as number,
            key: row.preview_key as string,
            sizeBytes: row.preview_size_bytes as number,
            width: row.preview_width as number,
          },
        }
      : {}),
    sizeBytes: row.size_bytes,
    storage: "r2",
  };
};

const toSession = (
  row: LessonResourceUploadRow
): LessonResourceUploadSession => ({
  actorUserId: row.actor_user_id,
  expiresAt: toDate(row.expires_at),
  lessonId: row.lesson_id,
  reference: toReference(row),
  status: row.status,
});

export const registerLessonResourceUpload = async ({
  actorUserId,
  lessonId,
  queryable,
  reference,
}: {
  actorUserId: string;
  lessonId: string;
  queryable?: LessonResourceUploadQueryable;
  reference: LessonResourceUploadReference;
}): Promise<void> => {
  const result = await getQueryable(queryable).query(
    `
      insert into staged_lesson_resource_uploads (
        resource_id,
        object_key,
        preview_object_key,
        lesson_id,
        actor_user_id,
        content_type,
        file_name,
        size_bytes,
        preview_content_type,
        preview_size_bytes,
        preview_width,
        preview_height
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      on conflict (resource_id) do nothing
    `,
    [
      reference.id,
      reference.key,
      reference.preview?.key ?? null,
      lessonId,
      actorUserId,
      reference.contentType,
      reference.fileName,
      reference.sizeBytes,
      reference.preview?.contentType ?? null,
      reference.preview?.sizeBytes ?? null,
      reference.preview?.width ?? null,
      reference.preview?.height ?? null,
    ]
  );
  assertMutation(result.rowCount);
};

const findLessonResourceUpload = async ({
  actorUserId,
  lessonId,
  queryable,
  resourceId,
  statusCondition,
}: {
  actorUserId: string;
  lessonId: string;
  queryable?: LessonResourceUploadQueryable;
  resourceId: string;
  statusCondition: string;
}): Promise<LessonResourceUploadSession | null> => {
  const result = await getQueryable(queryable).query<LessonResourceUploadRow>(
    `
      select
        resource_id,
        object_key,
        lesson_id,
        actor_user_id,
        content_type,
        file_name,
        size_bytes,
        preview_object_key as preview_key,
        preview_content_type,
        preview_size_bytes,
        preview_width,
        preview_height,
        status,
        expires_at
      from staged_lesson_resource_uploads
      where resource_id = $1
        and lesson_id = $2
        and actor_user_id = $3
        and ${statusCondition}
        and expires_at > now()
      limit 1
    `,
    [resourceId, lessonId, actorUserId]
  );

  const row = result.rows[0];
  return row ? toSession(row) : null;
};

export const getLessonResourceUpload = async (input: {
  actorUserId: string;
  lessonId: string;
  queryable?: LessonResourceUploadQueryable;
  resourceId: string;
}): Promise<LessonResourceUploadSession | null> =>
  await findLessonResourceUpload({
    ...input,
    statusCondition: "status in ('prepared', 'uploaded')",
  });

export const getPreparedLessonResourceUpload = async (input: {
  actorUserId: string;
  lessonId: string;
  queryable?: LessonResourceUploadQueryable;
  resourceId: string;
}): Promise<LessonResourceUploadSession | null> =>
  await findLessonResourceUpload({
    ...input,
    statusCondition: "status = 'prepared'",
  });

export const markLessonResourceUploadUploaded = async ({
  actorUserId,
  lessonId,
  queryable,
  resourceId,
}: {
  actorUserId: string;
  lessonId: string;
  queryable?: LessonResourceUploadQueryable;
  resourceId: string;
}): Promise<void> => {
  const result = await getQueryable(queryable).query(
    `
      update staged_lesson_resource_uploads
      set status = 'uploaded',
          updated_at = now()
      where resource_id = $1
        and lesson_id = $2
        and actor_user_id = $3
        and status in ('prepared', 'uploaded')
        and expires_at > now()
    `,
    [resourceId, lessonId, actorUserId]
  );
  assertMutation(result.rowCount);
};

export const consumeLessonResourceUpload = async ({
  actorUserId,
  lessonId,
  queryable,
  resourceId,
}: {
  actorUserId: string;
  lessonId: string;
  queryable?: LessonResourceUploadQueryable;
  resourceId: string;
}): Promise<void> => {
  const result = await getQueryable(queryable).query(
    `
      update staged_lesson_resource_uploads
      set status = 'consumed',
          updated_at = now()
      where resource_id = $1
        and lesson_id = $2
        and actor_user_id = $3
        and status in ('uploaded', 'consumed')
        and expires_at > now()
    `,
    [resourceId, lessonId, actorUserId]
  );
  assertMutation(result.rowCount);
};
