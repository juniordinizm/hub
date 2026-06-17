import "server-only";
import { getPool } from "@/db";
import {
  createJmvstreamClient,
  type JmvstreamCompleteUploadInput,
  type JmvstreamInitUploadInput,
} from "@/features/jmvstream/client";
import { getServerEnv } from "@/lib/env";

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

interface FolderRecord {
  folder_uuid: string | null;
  id: string;
  name: string;
  parent_folder_uuid: string | null;
  status: string;
}

interface LessonContext {
  course_id: string;
  course_title: string;
  lesson_title: string;
  module_id: string;
  module_title: string;
}

const getConfiguredClient = () => {
  const env = getServerEnv();

  if (!(env.JMVSTREAM_API_TOKEN && env.JMVSTREAM_PLAN_ID)) {
    throw new Error(
      "Configure JMVSTREAM_API_TOKEN e JMVSTREAM_PLAN_ID para usar a JMVStream."
    );
  }

  if (!env.JMVSTREAM_API_TOKEN.includes(".")) {
    throw new Error(
      "JMVSTREAM_API_TOKEN precisa ser o token Bearer retornado por /v1/authenticate. O valor atual parece um UUID/chave, nao o JWT da API."
    );
  }

  return createJmvstreamClient({
    apiBaseUrl: env.JMVSTREAM_API_BASE_URL,
    apiToken: env.JMVSTREAM_API_TOKEN,
    planId: env.JMVSTREAM_PLAN_ID,
  });
};

export const getJmvstreamAssets = async (): Promise<JmvstreamAsset[]> => {
  const { rows } = await getPool().query<{
    delete_status: string;
    filename: string;
    gallery_uuid: string | null;
    id: string;
    last_error: string | null;
    lesson_id: string | null;
    upload_status: string;
    video_hash: string;
  }>(
    `
      select id, lesson_id, video_hash, gallery_uuid, filename,
             upload_status, delete_status, last_error
      from jmvstream_video_assets
      where delete_status <> 'deleted'
      order by updated_at desc
    `
  );

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

export const ensureJmvstreamCourseFolder = async (
  courseId: string
): Promise<string | null> => {
  const { rows } = await getPool().query<{ title: string }>(
    "select title from courses where id = $1 limit 1",
    [courseId]
  );
  const course = rows[0];

  if (!course) {
    throw new Error("Curso invalido.");
  }

  return syncFolder({
    courseId,
    folderType: "course",
    name: course.title,
  });
};

export const ensureJmvstreamModuleFolder = async (
  moduleId: string
): Promise<string | null> => {
  const context = await getModuleContext(moduleId);

  if (!context) {
    throw new Error("Modulo invalido.");
  }

  return ensureJmvstreamCourseFolder(context.course_id);
};

export const requireJmvstreamModuleFolder = async (
  moduleId: string
): Promise<string> => {
  const folderUuid = await ensureJmvstreamModuleFolder(moduleId);

  if (folderUuid) {
    return folderUuid;
  }

  const { rows } = await getPool().query<{ last_error: string | null }>(
    `
      select jf.last_error
      from modules m
      left join jmvstream_folders jf
        on jf.course_id = m.course_id
       and jf.folder_type = 'course'
      where m.id = $1
      order by updated_at desc
      limit 1
    `,
    [moduleId]
  );
  const detail = rows[0]?.last_error ? ` Detalhe: ${rows[0].last_error}` : "";

  throw new Error(
    `Nao foi possivel garantir a pasta JMVStream do curso.${detail}`
  );
};

export const initJmvstreamUpload = async ({
  fileName,
  fileSize,
  lessonId,
  uploadType,
}: {
  fileName: string;
  fileSize: number;
  lessonId: string;
  uploadType: JmvstreamInitUploadInput["uploadType"];
}) => {
  const lesson = await getLessonContext(lessonId);

  if (!lesson) {
    throw new Error("Aula invalida.");
  }

  const galleryUuid = await requireJmvstreamModuleFolder(lesson.module_id);

  const chunkSize = uploadType === "multipart" ? 8 * 1024 * 1024 : undefined;
  const totalParts =
    chunkSize && fileSize > 0 ? Math.ceil(fileSize / chunkSize) : undefined;

  return getConfiguredClient().initMultipartUpload({
    ...(chunkSize ? { chunkSize } : {}),
    fileName,
    fileSize,
    galleryUuid,
    ...(totalParts ? { totalParts } : {}),
    uploadType,
  });
};

export const completeJmvstreamUpload = async ({
  filename,
  lessonId,
  objectName,
  parts,
  size,
  uploadId,
  videoHash,
}: Omit<JmvstreamCompleteUploadInput, "galleryUuid"> & {
  lessonId: string;
}): Promise<void> => {
  const lesson = await getLessonContext(lessonId);

  if (!lesson) {
    throw new Error("Aula invalida.");
  }

  await assertJmvstreamVideoHashAvailable(videoHash, lessonId);
  const galleryUuid = await requireJmvstreamModuleFolder(lesson.module_id);

  const response = await getConfiguredClient().completeMultipartUpload({
    filename,
    galleryUuid,
    objectName,
    parts,
    size,
    uploadId,
    videoHash,
  });

  await deleteActiveAssetsForLesson(lessonId, videoHash);
  await getPool().query(
    `
      insert into jmvstream_video_assets (
        lesson_id, module_id, course_id, video_hash, gallery_uuid, filename,
        size_bytes, object_name, upload_id, job_id, upload_status, delete_status
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'processing', 'none')
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
      response.jobId,
    ]
  );
  await getPool().query(
    `
      update lessons
      set video_provider = 'jmvstream',
          video_external_id = $1,
          updated_at = now()
      where id = $2
    `,
    [videoHash, lessonId]
  );
};

export const syncManualJmvstreamVideoAsset = async ({
  lessonId,
  videoHash,
}: {
  lessonId: string;
  videoHash: string | null;
}): Promise<void> => {
  if (!videoHash) {
    await deleteActiveAssetsForLesson(lessonId);
    return;
  }

  const lesson = await getLessonContext(lessonId);

  if (!lesson) {
    throw new Error("Aula invalida.");
  }

  await assertJmvstreamVideoHashAvailable(videoHash, lessonId);
  const galleryUuid = await ensureJmvstreamModuleFolder(lesson.module_id);

  await deleteActiveAssetsForLesson(lessonId, videoHash);
  await getPool().query(
    `
      insert into jmvstream_video_assets (
        lesson_id, module_id, course_id, video_hash, gallery_uuid, filename,
        upload_status, delete_status
      )
      values ($1, $2, $3, $4, $5, $6, 'ready', 'none')
      on conflict (video_hash) do update set
        lesson_id = excluded.lesson_id,
        module_id = excluded.module_id,
        course_id = excluded.course_id,
        gallery_uuid = excluded.gallery_uuid,
        filename = excluded.filename,
        upload_status = 'ready',
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
      `Manual - ${lesson.lesson_title}`,
    ]
  );
};

export const deleteJmvstreamAssetsForCourse = async (
  courseId: string
): Promise<void> => {
  await deleteAssetsByQuery("course_id = $1", [courseId]);
};

export const deleteJmvstreamAssetsForLesson = async (
  lessonId: string
): Promise<void> => {
  await deleteAssetsByQuery("lesson_id = $1", [lessonId]);
};

export const deleteJmvstreamAssetsForModule = async (
  moduleId: string
): Promise<void> => {
  await deleteAssetsByQuery("module_id = $1", [moduleId]);
};

export const retryJmvstreamAssetDelete = async (
  assetId: string
): Promise<void> => {
  const { rows } = await getPool().query<{ id: string }>(
    "select id from jmvstream_video_assets where id = $1 limit 1",
    [assetId]
  );

  if (!rows[0]) {
    throw new Error("Asset JMVStream invalido.");
  }

  await deleteAssetById(assetId);
};

const syncFolder = async ({
  courseId,
  folderType,
  moduleId = null,
  name,
  parentFolderUuid = null,
}: {
  courseId: string;
  folderType: "course" | "module";
  moduleId?: null | string;
  name: string;
  parentFolderUuid?: null | string;
}): Promise<string | null> => {
  const existing = await getExistingFolder(folderType, courseId, moduleId);

  try {
    const client = getConfiguredClient();
    const parentChanged =
      existing?.folder_uuid &&
      folderType === "module" &&
      existing.parent_folder_uuid !== parentFolderUuid;
    const existingFolderUuid = existing?.folder_uuid ?? null;
    const existingFolderName = existing?.name ?? null;
    const shouldCreate = !existingFolderUuid || parentChanged;
    let folder: { name: string; uuid: string };

    if (shouldCreate) {
      folder = await client.createFolder({ name, parentFolderUuid });
    } else if (existingFolderName === name) {
      folder = {
        name,
        uuid: existingFolderUuid,
      };
    } else {
      folder = await client.renameFolder({
        folderUuid: existingFolderUuid,
        name,
      });
    }

    await upsertFolder({
      courseId,
      folderType,
      folderUuid: folder.uuid,
      lastError: parentChanged
        ? `Pasta anterior ${existing?.folder_uuid} mantida na JMVStream para revisao manual.`
        : null,
      moduleId,
      name: folder.name,
      parentFolderUuid,
      status: parentChanged ? "needs_review" : "active",
    });

    return folder.uuid;
  } catch (error) {
    await upsertFolder({
      courseId,
      folderType,
      folderUuid: existing?.folder_uuid ?? null,
      lastError: error instanceof Error ? error.message : "Erro JMVStream.",
      moduleId,
      name,
      parentFolderUuid,
      status: "failed",
    });

    return existing?.folder_uuid ?? null;
  }
};

const getExistingFolder = async (
  folderType: "course" | "module",
  courseId: string,
  moduleId: null | string
): Promise<FolderRecord | null> => {
  const { rows } = await getPool().query<FolderRecord>(
    `
      select id, folder_uuid, name, parent_folder_uuid, status
      from jmvstream_folders
      where folder_type = $1
        and (
          ($1 = 'course' and course_id = $2)
          or ($1 = 'module' and module_id = $3)
        )
      limit 1
    `,
    [folderType, courseId, moduleId]
  );

  return rows[0] ?? null;
};

const upsertFolder = async ({
  courseId,
  folderType,
  folderUuid,
  lastError,
  moduleId,
  name,
  parentFolderUuid,
  status,
}: {
  courseId: string;
  folderType: "course" | "module";
  folderUuid: null | string;
  lastError: null | string;
  moduleId: null | string;
  name: string;
  parentFolderUuid: null | string;
  status: "active" | "failed" | "needs_review";
}): Promise<void> => {
  const existing = await getExistingFolder(folderType, courseId, moduleId);

  if (existing) {
    await getPool().query(
      `
        update jmvstream_folders
        set folder_uuid = $1,
            name = $2,
            parent_folder_uuid = $3,
            status = $4,
            last_error = $5,
            updated_at = now()
        where id = $6
      `,
      [folderUuid, name, parentFolderUuid, status, lastError, existing.id]
    );
    return;
  }

  await getPool().query(
    `
      insert into jmvstream_folders (
        course_id, module_id, folder_uuid, folder_type, name,
        parent_folder_uuid, status, last_error
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      courseId,
      moduleId,
      folderUuid,
      folderType,
      name,
      parentFolderUuid,
      status,
      lastError,
    ]
  );
};

const getModuleContext = async (
  moduleId: string
): Promise<{ course_id: string; title: string } | null> => {
  const { rows } = await getPool().query<{ course_id: string; title: string }>(
    "select course_id, title from modules where id = $1 limit 1",
    [moduleId]
  );

  return rows[0] ?? null;
};

const getLessonContext = async (
  lessonId: string
): Promise<LessonContext | null> => {
  const { rows } = await getPool().query<LessonContext>(
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

const deleteActiveAssetsForLesson = async (
  lessonId: string,
  exceptVideoHash?: string
): Promise<void> => {
  const params: unknown[] = [lessonId];
  const exceptCondition = exceptVideoHash ? "and video_hash <> $2" : "";

  if (exceptVideoHash) {
    params.push(exceptVideoHash);
  }

  await deleteAssetsByQuery(
    `lesson_id = $1 and delete_status <> 'deleted' ${exceptCondition}`,
    params
  );
};

const deleteAssetsByQuery = async (
  whereClause: string,
  values: unknown[]
): Promise<void> => {
  const { rows } = await getPool().query<{ id: string }>(
    `
      select id
      from jmvstream_video_assets
      where ${whereClause}
    `,
    values
  );

  for (const row of rows) {
    await deleteAssetById(row.id);
  }
};

const deleteAssetById = async (assetId: string): Promise<void> => {
  const { rows } = await getPool().query<{
    video_hash: string;
  }>("select video_hash from jmvstream_video_assets where id = $1 limit 1", [
    assetId,
  ]);
  const asset = rows[0];

  if (!asset) {
    return;
  }

  await getPool().query(
    `
      update jmvstream_video_assets
      set delete_status = 'pending',
          delete_attempts = delete_attempts + 1,
          updated_at = now()
      where id = $1
    `,
    [assetId]
  );

  try {
    await getConfiguredClient().deleteVideo(asset.video_hash);
    await getPool().query(
      `
        update jmvstream_video_assets
        set delete_status = 'deleted',
            lesson_id = null,
            last_error = null,
            updated_at = now()
        where id = $1
      `,
      [assetId]
    );
  } catch (error) {
    await getPool().query(
      `
        update jmvstream_video_assets
        set delete_status = 'failed',
            last_error = $2,
            updated_at = now()
        where id = $1
      `,
      [
        assetId,
        error instanceof Error
          ? error.message
          : "Nao foi possivel apagar o video na JMVStream.",
      ]
    );
  }
};
