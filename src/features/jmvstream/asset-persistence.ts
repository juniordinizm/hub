import "server-only";
import { getPool } from "@/db";

export interface JmvstreamAsset {
  deleteStatus: string;
  filename: string;
  galleryUuid: string | null;
  id: string;
  lastError: string | null;
  lessonId: string | null;
  uploadStatus: string;
  videoHash: string;
}

interface JmvstreamAssetRow {
  delete_status: string;
  filename: string;
  gallery_uuid: string | null;
  id: string;
  last_error: string | null;
  lesson_id: string | null;
  upload_status: string;
  video_hash: string;
}

export interface JmvstreamLessonContext {
  course_id: string;
  course_title: string;
  lesson_title: string;
  module_id: string;
  module_title: string;
}

const STALE_UPLOAD_INTERVAL = "6 hours";

export const getJmvstreamAssets = (): Promise<JmvstreamAsset[]> =>
  readJmvstreamAssets();

export const getJmvstreamAssetsForLesson = (
  lessonId: string
): Promise<JmvstreamAsset[]> => readJmvstreamAssets({ lessonId });

const readJmvstreamAssets = async ({
  lessonId,
}: {
  lessonId?: string;
} = {}): Promise<JmvstreamAsset[]> => {
  const lessonScope = lessonId ? "and lesson_id = $1" : "";
  const query = `
    select id, lesson_id, video_hash, gallery_uuid, filename,
           upload_status, delete_status, last_error
    from jmvstream_video_assets
    where delete_status <> 'deleted'
    ${lessonScope}
    order by jmvstream_video_assets.updated_at desc
  `;
  const { rows } = lessonId
    ? await getPool().query<JmvstreamAssetRow>(query, [lessonId])
    : await getPool().query<JmvstreamAssetRow>(query);

  return rows.map((row) => ({
    deleteStatus: row.delete_status,
    filename: row.filename,
    galleryUuid: row.gallery_uuid,
    id: row.id,
    lastError: row.last_error,
    lessonId: row.lesson_id,
    uploadStatus: row.upload_status,
    videoHash: row.video_hash,
  }));
};

export const getJmvstreamLessonContext = async (
  lessonId: string
): Promise<JmvstreamLessonContext | null> => {
  const { rows } = await getPool().query<JmvstreamLessonContext>(
    `
      select l.title as lesson_title, m.id as module_id, m.title as module_title,
             c.id as course_id, c.title as course_title
      from lessons l
      join modules m on m.id = l.module_id
      join courses c on c.id = m.course_id
      where l.id = $1
      limit 1
    `,
    [lessonId]
  );

  return rows[0] ?? null;
};

export const recordJmvstreamUploadSession = async ({
  fileName,
  fileSize,
  galleryUuid,
  lesson,
  lessonId,
  objectName,
  uploadId,
  videoHash,
}: {
  fileName: string;
  fileSize: number;
  galleryUuid: string;
  lesson: JmvstreamLessonContext;
  lessonId: string;
  objectName: string;
  uploadId: string;
  videoHash: string;
}): Promise<string> => {
  const { rows } = await getPool().query<{ id: string }>(
    `
      insert into jmvstream_video_assets (
        lesson_id, module_id, course_id, video_hash, gallery_uuid, filename,
        size_bytes, object_name, upload_id, upload_status, delete_status
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'uploading', 'none')
      on conflict (video_hash) do update set
        lesson_id = excluded.lesson_id,
        module_id = excluded.module_id,
        course_id = excluded.course_id,
        gallery_uuid = excluded.gallery_uuid,
        filename = excluded.filename,
        size_bytes = excluded.size_bytes,
        object_name = excluded.object_name,
        upload_id = excluded.upload_id,
        upload_status = 'uploading',
        delete_status = 'none',
        last_error = null,
        updated_at = now()
      returning id
    `,
    [
      lessonId,
      lesson.module_id,
      lesson.course_id,
      videoHash,
      galleryUuid,
      fileName,
      fileSize,
      objectName,
      uploadId,
    ]
  );
  const uploadSessionId = rows[0]?.id;

  if (!uploadSessionId) {
    throw new Error("Nao foi possivel registrar a sessao de upload JMVStream.");
  }

  return uploadSessionId;
};

export const assertJmvstreamVideoHashAvailable = async (
  videoHash: string,
  lessonId?: string
): Promise<void> => {
  const { rows } = await getPool().query<{ lesson_id: string | null }>(
    `
      select lesson_id
      from jmvstream_video_assets
      where video_hash = $1
        and delete_status <> 'deleted'
      limit 1
    `,
    [videoHash]
  );
  const ownerLessonId = rows[0]?.lesson_id;

  if (ownerLessonId && ownerLessonId !== lessonId) {
    throw new Error(
      "Este video_hash da JMVStream ja esta vinculado a outra aula."
    );
  }
};

export const assertJmvstreamUploadSessionMatches = async ({
  lessonId,
  uploadSessionId,
  videoHash,
}: {
  lessonId: string;
  uploadSessionId: string;
  videoHash: string;
}): Promise<void> => {
  const { rows } = await getPool().query<{ id: string }>(
    `
      select id
      from jmvstream_video_assets
      where id = $1
        and lesson_id = $2
        and video_hash = $3
        and upload_status = 'uploading'
        and delete_status = 'none'
      limit 1
    `,
    [uploadSessionId, lessonId, videoHash]
  );

  if (!rows[0]) {
    throw new Error("Sessao de upload JMVStream invalida ou expirada.");
  }
};

export const markJmvstreamUploadFailed = async ({
  lastError,
  videoHash,
}: {
  lastError: string;
  videoHash: string;
}): Promise<void> => {
  await getPool().query(
    `
      update jmvstream_video_assets
      set upload_status = 'failed',
          last_error = $2,
          updated_at = now()
      where video_hash = $1
    `,
    [videoHash, lastError]
  );
};

export const discardJmvstreamUpload = async ({
  assetId,
}: {
  assetId: string;
}): Promise<void> => {
  await getPool().query(
    `
      update jmvstream_video_assets
      set delete_status = 'deleted',
          lesson_id = null,
          last_error = null,
          updated_at = now()
      where id = $1
        and upload_status = 'failed'
        and delete_status = 'none'
    `,
    [assetId]
  );
};

export const recordCompletedJmvstreamUpload = async ({
  filename,
  galleryUuid,
  jobId,
  lesson,
  lessonId,
  objectName,
  size,
  uploadId,
  uploadStatus,
  videoHash,
}: {
  filename: string;
  galleryUuid: string;
  jobId: string | null;
  lesson: JmvstreamLessonContext;
  lessonId: string;
  objectName: string;
  size: number;
  uploadId: string;
  uploadStatus: "processing" | "ready";
  videoHash: string;
}): Promise<void> => {
  await getPool().query(
    `
      insert into jmvstream_video_assets (
        lesson_id, module_id, course_id, video_hash, gallery_uuid, filename,
        size_bytes, object_name, upload_id, job_id, upload_status, delete_status
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'none')
      on conflict (video_hash) do update set
        lesson_id = excluded.lesson_id,
        module_id = excluded.module_id,
        course_id = excluded.course_id,
        gallery_uuid = excluded.gallery_uuid,
        filename = excluded.filename,
        size_bytes = excluded.size_bytes,
        object_name = excluded.object_name,
        upload_id = excluded.upload_id,
        job_id = excluded.job_id,
        upload_status = excluded.upload_status,
        delete_status = 'none',
        last_error = null,
        updated_at = now()
    `,
    [
      lessonId,
      lesson.module_id,
      lesson.course_id,
      videoHash,
      galleryUuid,
      filename,
      size,
      objectName,
      uploadId,
      jobId,
      uploadStatus,
    ]
  );
};

export const linkJmvstreamVideoToLesson = async ({
  lessonId,
  playerUrl,
  thumbnailUrl,
  videoHash,
}: {
  lessonId: string;
  playerUrl: string | null;
  thumbnailUrl: string | null;
  videoHash: string;
}): Promise<void> => {
  await getPool().query(
    `
      update lessons
      set video_provider = 'jmvstream',
          video_external_id = $1,
          video_embed_url = $3,
          thumbnail_url = $4,
          updated_at = now()
      where id = $2
    `,
    [videoHash, lessonId, playerUrl, thumbnailUrl]
  );
};

export const getJmvstreamLessonVideo = async (
  lessonId: string
): Promise<{ courseId: string; videoHash: string } | null> => {
  const { rows } = await getPool().query<{
    course_id: string;
    video_external_id: string | null;
  }>(
    `
      select m.course_id, l.video_external_id
      from lessons l
      join modules m on m.id = l.module_id
      where l.id = $1
      limit 1
    `,
    [lessonId]
  );
  const lesson = rows[0];

  return lesson?.video_external_id
    ? { courseId: lesson.course_id, videoHash: lesson.video_external_id }
    : null;
};

export const recordJmvstreamReadyPlayer = async ({
  lessonId,
  playerUrl,
  thumbnailUrl,
  videoHash,
}: {
  lessonId: string;
  playerUrl: string;
  thumbnailUrl: string | null;
  videoHash: string;
}): Promise<void> => {
  await getPool().query(
    `
      update lessons
      set video_embed_url = $1,
          thumbnail_url = $3,
          updated_at = now()
      where id = $2
    `,
    [playerUrl, lessonId, thumbnailUrl]
  );
  await getPool().query(
    `
      update jmvstream_video_assets
      set upload_status = 'ready',
          last_error = null,
          updated_at = now()
      where video_hash = $1
    `,
    [videoHash]
  );
};

export const getPendingJmvstreamPlayerLessons = async (
  limit: number
): Promise<string[]> => {
  const { rows } = await getPool().query<{ lesson_id: string }>(
    `
      select lesson_id
      from jmvstream_video_assets
      where upload_status = 'processing'
        and delete_status = 'none'
        and lesson_id is not null
      order by jmvstream_video_assets.updated_at asc
      limit $1
    `,
    [limit]
  );

  return rows.map((row) => row.lesson_id);
};

export const markJmvstreamAssetMovePending = async ({
  videoHash,
}: {
  videoHash: string;
}): Promise<void> => {
  await getPool().query(
    `
      update jmvstream_video_assets
      set last_error = null,
          updated_at = now()
      where video_hash = $1
        and delete_status <> 'deleted'
    `,
    [videoHash]
  );
};

export const markJmvstreamAssetInGallery = async ({
  galleryUuid,
  videoHash,
}: {
  galleryUuid: string;
  videoHash: string;
}): Promise<void> => {
  await getPool().query(
    `
      update jmvstream_video_assets
      set gallery_uuid = $2,
          last_error = null,
          updated_at = now()
      where video_hash = $1
        and delete_status <> 'deleted'
    `,
    [videoHash, galleryUuid]
  );
};

export const recordJmvstreamAssetMoveFailure = async ({
  lastError,
  videoHash,
}: {
  lastError: string;
  videoHash: string;
}): Promise<void> => {
  await getPool().query(
    `
      update jmvstream_video_assets
      set last_error = $2,
          updated_at = now()
      where video_hash = $1
        and delete_status <> 'deleted'
    `,
    [videoHash, lastError]
  );
};

export const touchJmvstreamProcessingAsset = async (
  videoHash: string
): Promise<void> => {
  await getPool().query(
    `
      update jmvstream_video_assets
      set updated_at = now()
      where video_hash = $1
        and upload_status = 'processing'
        and delete_status = 'none'
    `,
    [videoHash]
  );
};

export const expireStaleJmvstreamUploads = async (): Promise<void> => {
  await getPool().query(
    `
      update jmvstream_video_assets
      set upload_status = 'failed',
          last_error = $1,
          updated_at = now()
      where upload_status = 'uploading'
        and updated_at < now() - $2::interval
    `,
    [
      "Upload JMVStream expirado antes da finalizacao. Tente enviar novamente ou cancele e limpe a sessao.",
      STALE_UPLOAD_INTERVAL,
    ]
  );
};
