import "server-only";
import { getPool } from "@/db";
import {
  authenticateJmvstreamApi,
  createJmvstreamClient,
  findJmvstreamFolderByName,
  findJmvstreamFolderByUuid,
  findJmvstreamVideoByHash,
  getJmvstreamThumbnailUrlFromPlayerHtml,
  isJmvstreamJwtUsable,
  type JmvstreamCompleteUploadInput,
  type JmvstreamCompleteUploadResponse,
  type JmvstreamFolderResponse,
  type JmvstreamInitUploadInput,
} from "@/features/jmvstream/client";
import { JMVSTREAM_UPLOAD_CHUNK_SIZE } from "@/features/jmvstream/upload-config";
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

export interface JmvstreamHealthSummary {
  auth: "error" | "ok";
  failedDeletes: number;
  failedUploads: number;
  folderCount: number;
  message: string;
  orphanFolders: number;
  pendingDeletes: number;
  processingUploads: number;
}

export interface JmvstreamPlayerSyncResult {
  playerUrl: null | string;
  ready: boolean;
  thumbnailUrl: null | string;
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

let cachedApiToken: string | null = null;
const STALE_UPLOAD_INTERVAL = "6 hours";

const getConfiguredClient = async () => {
  const env = getServerEnv();

  if (!env.JMVSTREAM_PLAN_ID) {
    throw new Error("Configure JMVSTREAM_PLAN_ID para usar a JMVStream.");
  }

  const apiToken = await getJmvstreamApiToken();

  return createJmvstreamClient({
    apiBaseUrl: env.JMVSTREAM_API_BASE_URL,
    apiToken,
    planId: env.JMVSTREAM_PLAN_ID,
  });
};

const getJmvstreamApiToken = async (): Promise<string> => {
  const env = getServerEnv();
  const configuredToken = env.JMVSTREAM_API_TOKEN;

  if (configuredToken && isJmvstreamJwtUsable(configuredToken)) {
    return configuredToken;
  }

  if (isJmvstreamJwtUsable(cachedApiToken)) {
    return cachedApiToken as string;
  }

  if (
    env.JMVSTREAM_AUTH_EMAIL &&
    env.JMVSTREAM_AUTH_PASSWORD &&
    env.JMVSTREAM_AUTH_RESOURCE
  ) {
    cachedApiToken = await authenticateJmvstreamApi({
      apiBaseUrl: env.JMVSTREAM_API_BASE_URL,
      email: env.JMVSTREAM_AUTH_EMAIL,
      password: env.JMVSTREAM_AUTH_PASSWORD,
      resource: env.JMVSTREAM_AUTH_RESOURCE,
    });
    return cachedApiToken;
  }

  if (env.JMVSTREAM_API_TOKEN) {
    throw new Error(
      "O token JMVStream configurado expirou. Configure JMVSTREAM_AUTH_EMAIL, JMVSTREAM_AUTH_PASSWORD e JMVSTREAM_AUTH_RESOURCE para renovacao automatica."
    );
  }

  throw new Error(
    "Configure credenciais JMVStream server-only para usar uploads no admin."
  );
};

export const resolveJmvstreamPlayerThumbnailUrl = async (
  playerUrl: string | null
): Promise<string | null> => {
  if (!playerUrl) {
    return null;
  }

  try {
    const response = await fetch(playerUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!response.ok) {
      return null;
    }

    return getJmvstreamThumbnailUrlFromPlayerHtml(await response.text());
  } catch {
    return null;
  }
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
      order by jmvstream_video_assets.updated_at desc
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

export const getJmvstreamHealthSummary =
  async (): Promise<JmvstreamHealthSummary> => {
    await markStaleJmvstreamUploadsFailed();
    const assets = await getJmvstreamAssets();
    const failedUploads = assets.filter(
      (asset) => asset.uploadStatus === "failed"
    ).length;
    const processingUploads = assets.filter((asset) =>
      ["processing", "uploading"].includes(asset.uploadStatus)
    ).length;
    const failedDeletes = assets.filter(
      (asset) => asset.deleteStatus === "failed"
    ).length;
    const pendingDeletes = assets.filter(
      (asset) => asset.deleteStatus === "pending"
    ).length;

    try {
      const folders = await (await getConfiguredClient()).listFolders();
      const orphanFolders = await countLocalOrphanFolders(folders);

      return {
        auth: "ok",
        failedDeletes,
        failedUploads,
        folderCount: countFolders(folders),
        message:
          orphanFolders > 0
            ? `JMVStream autenticada; ${orphanFolders} pasta(s) locais nao existem mais na JMVStream e serao recriadas no proximo uso.`
            : "JMVStream autenticada e galerias acessiveis.",
        orphanFolders,
        pendingDeletes,
        processingUploads,
      };
    } catch (error) {
      return {
        auth: "error",
        failedDeletes,
        failedUploads,
        folderCount: 0,
        message:
          error instanceof Error
            ? error.message
            : "Nao foi possivel validar a JMVStream.",
        orphanFolders: 0,
        pendingDeletes,
        processingUploads,
      };
    }
  };

const countFolders = (folders: JmvstreamFolderResponse[]): number =>
  folders.reduce(
    (sum, folder) =>
      sum +
      1 +
      countFolders(Array.isArray(folder.children) ? folder.children : []),
    0
  );

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

export const requireJmvstreamCourseFolder = async (
  courseId: string
): Promise<string> => {
  const folderUuid = await ensureJmvstreamCourseFolder(courseId);

  if (folderUuid) {
    return folderUuid;
  }

  const { rows } = await getPool().query<{ last_error: string | null }>(
    `
      select last_error
      from jmvstream_folders
      where course_id = $1
        and folder_type = 'course'
      order by jmvstream_folders.updated_at desc
      limit 1
    `,
    [courseId]
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

  const galleryUuid = await requireJmvstreamCourseFolder(lesson.course_id);

  const chunkSize =
    uploadType === "multipart" ? JMVSTREAM_UPLOAD_CHUNK_SIZE : undefined;
  const totalParts =
    chunkSize && fileSize > 0 ? Math.ceil(fileSize / chunkSize) : undefined;

  const init = await (await getConfiguredClient()).initMultipartUpload({
    ...(chunkSize ? { chunkSize } : {}),
    fileName,
    fileSize,
    galleryUuid,
    ...(totalParts ? { totalParts } : {}),
    uploadType,
  });

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
      init.videoHash,
      galleryUuid,
      fileName,
      fileSize,
      init.objectName,
      init.uploadId,
    ]
  );

  const uploadSessionId = rows[0]?.id;

  if (!uploadSessionId) {
    throw new Error("Nao foi possivel registrar a sessao de upload JMVStream.");
  }

  return {
    ...init,
    uploadSessionId,
  };
};

export const completeJmvstreamUpload = async ({
  filename,
  lessonId,
  objectName,
  parts,
  size,
  uploadSessionId,
  uploadId,
  videoHash,
}: Omit<JmvstreamCompleteUploadInput, "galleryUuid"> & {
  lessonId: string;
  uploadSessionId: string;
}): Promise<void> => {
  const lesson = await getLessonContext(lessonId);

  if (!lesson) {
    throw new Error("Aula invalida.");
  }

  await assertJmvstreamUploadSessionMatches({
    lessonId,
    uploadSessionId,
    videoHash,
  });
  await assertJmvstreamVideoHashAvailable(videoHash, lessonId);
  const galleryUuid = await requireJmvstreamCourseFolder(lesson.course_id);
  const client = await getConfiguredClient();

  let response: JmvstreamCompleteUploadResponse;

  try {
    response = await client.completeMultipartUpload({
      filename,
      galleryUuid,
      objectName,
      parts,
      size,
      uploadId,
      videoHash,
    });
  } catch (error) {
    await markJmvstreamUploadFailed({
      lastError:
        error instanceof Error
          ? error.message
          : "Nao foi possivel finalizar o upload na JMVStream.",
      videoHash,
    });
    throw error;
  }

  await deleteActiveAssetsForLesson(lessonId, videoHash);
  const videos = await client.listVideos();
  const syncedVideo = findJmvstreamVideoByHash(videos, videoHash);
  await moveJmvstreamVideoToCourseFolder({
    client,
    galleryUuid,
    video: syncedVideo,
    videoHash,
  });
  const playerUrl = response.playerUrl ?? syncedVideo?.playerUrl ?? null;
  const thumbnailUrl = await resolveJmvstreamPlayerThumbnailUrl(playerUrl);
  const uploadStatus = playerUrl ? "ready" : "processing";
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
      response.jobId,
      uploadStatus,
    ]
  );
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

export const syncJmvstreamLessonPlayer = async (
  lessonId: string
): Promise<JmvstreamPlayerSyncResult> => {
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
  const videoHash = lesson?.video_external_id;

  if (!(lesson && videoHash)) {
    return { playerUrl: null, ready: false, thumbnailUrl: null };
  }

  const client = await getConfiguredClient();
  const video = findJmvstreamVideoByHash(await client.listVideos(), videoHash);
  const playerUrl = video?.playerUrl ?? null;
  const galleryUuid = await requireJmvstreamCourseFolder(lesson.course_id);

  await moveJmvstreamVideoToCourseFolder({
    client,
    galleryUuid,
    video,
    videoHash,
  });

  if (!playerUrl) {
    return { playerUrl: null, ready: false, thumbnailUrl: null };
  }

  const thumbnailUrl = await resolveJmvstreamPlayerThumbnailUrl(playerUrl);
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

  return { playerUrl, ready: true, thumbnailUrl };
};

const moveJmvstreamVideoToCourseFolder = async ({
  client,
  galleryUuid,
  video,
  videoHash,
}: {
  client: Awaited<ReturnType<typeof getConfiguredClient>>;
  galleryUuid: string;
  video?: ReturnType<typeof findJmvstreamVideoByHash>;
  videoHash: string;
}): Promise<void> => {
  if (!video) {
    await markJmvstreamAssetMovePending({ videoHash });
    return;
  }

  if (video?.folderUuid === galleryUuid) {
    await markJmvstreamAssetInGallery({ galleryUuid, videoHash });
    return;
  }

  try {
    if (video.folderUuid !== galleryUuid) {
      await client.moveVideo(videoHash, galleryUuid);
      await markJmvstreamAssetInGallery({ galleryUuid, videoHash });
      return;
    }
  } catch (error) {
    if (isJmvstreamVideoNotFoundError(error)) {
      await markJmvstreamAssetMovePending({ videoHash });
      return;
    }

    await getPool().query(
      `
        update jmvstream_video_assets
        set last_error = $2,
            updated_at = now()
        where video_hash = $1
          and delete_status <> 'deleted'
      `,
      [
        videoHash,
        error instanceof Error
          ? `Video pronto, mas ainda nao foi movido para a galeria do curso: ${error.message}`
          : "Video pronto, mas ainda nao foi movido para a galeria do curso.",
      ]
    );
  }
};

const markJmvstreamAssetMovePending = async ({
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

const isJmvstreamVideoNotFoundError = (error: unknown): boolean =>
  error instanceof Error &&
  error.message.trim().toLocaleLowerCase() === "video not found";

const markJmvstreamAssetInGallery = async ({
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
  const galleryUuid = await ensureJmvstreamCourseFolder(lesson.course_id);

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
  const { rows } = await getPool().query<{
    video_external_id: string | null;
  }>("select video_external_id from lessons where id = $1 limit 1", [lessonId]);
  const videoHash = rows[0]?.video_external_id;

  if (videoHash) {
    await deleteAssetsByQuery("(lesson_id = $1 or video_hash = $2)", [
      lessonId,
      videoHash,
    ]);
    return;
  }

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
    const client = await getConfiguredClient();
    const remoteFolders = await client.listFolders();
    const parentChanged =
      existing?.folder_uuid &&
      folderType === "module" &&
      existing.parent_folder_uuid !== parentFolderUuid;
    const existingFolderUuid = existing?.folder_uuid ?? null;
    const existingFolderName = existing?.name ?? null;
    const existingRemoteFolder = existingFolderUuid
      ? findJmvstreamFolderByUuid(remoteFolders, existingFolderUuid)
      : null;
    const missingRemoteFolder = Boolean(
      existingFolderUuid && !existingRemoteFolder
    );
    const shouldCreate =
      !existingFolderUuid || parentChanged || missingRemoteFolder;
    let folder: { name: string; uuid: string };

    if (shouldCreate) {
      const existingRemoteFolder = findJmvstreamFolderByName(
        remoteFolders,
        name
      );
      folder = existingRemoteFolder
        ? { name: existingRemoteFolder.name, uuid: existingRemoteFolder.uuid }
        : await client.createFolder({ name, parentFolderUuid });
    } else if (existingFolderName === name) {
      folder = {
        name: existingRemoteFolder?.name ?? name,
        uuid: existingFolderUuid,
      };
    } else {
      folder = await client.renameFolder({
        folderUuid: existingFolderUuid,
        name,
      });
    }

    const syncLastError = getFolderSyncLastError({
      existingFolderUuid: existing?.folder_uuid ?? null,
      missingRemoteFolder,
      parentChanged: Boolean(parentChanged),
    });

    await upsertFolder({
      courseId,
      folderType,
      folderUuid: folder.uuid,
      lastError: syncLastError,
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

const getFolderSyncLastError = ({
  existingFolderUuid,
  missingRemoteFolder,
  parentChanged,
}: {
  existingFolderUuid: null | string;
  missingRemoteFolder: boolean;
  parentChanged: boolean;
}): null | string => {
  if (parentChanged) {
    return `Pasta anterior ${existingFolderUuid} mantida na JMVStream para revisao manual.`;
  }

  if (missingRemoteFolder) {
    return `Pasta local ${existingFolderUuid} nao existe mais na JMVStream e foi recriada.`;
  }

  return null;
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

const assertJmvstreamUploadSessionMatches = async ({
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
    const client = await getConfiguredClient();
    await client.deleteVideo(asset.video_hash);
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

const markStaleJmvstreamUploadsFailed = async (): Promise<void> => {
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

const countLocalOrphanFolders = async (
  folders: JmvstreamFolderResponse[]
): Promise<number> => {
  const remoteFolderUuids = new Set(flattenFolderUuids(folders));
  const { rows } = await getPool().query<{ folder_uuid: string }>(
    `
      select folder_uuid
      from jmvstream_folders
      where folder_uuid is not null
        and status = 'active'
    `
  );

  return rows.filter((row) => !remoteFolderUuids.has(row.folder_uuid)).length;
};

const flattenFolderUuids = (folders: JmvstreamFolderResponse[]): string[] => {
  const uuids: string[] = [];

  for (const folder of folders) {
    uuids.push(folder.uuid);
    uuids.push(...flattenFolderUuids(folder.children ?? []));
  }

  return uuids;
};
