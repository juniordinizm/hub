import "server-only";
import { getPool } from "@/db";
import { getConfiguredJmvstreamClient } from "@/features/jmvstream/auth";
import {
  findJmvstreamFolderByName,
  findJmvstreamFolderByUuid,
  type JmvstreamFolderResponse,
} from "@/features/jmvstream/client";

interface FolderRecord {
  folder_uuid: string | null;
  id: string;
  name: string;
  parent_folder_uuid: string | null;
  status: string;
}

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

  return syncCourseFolder({ courseId, name: course.title });
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

export const countJmvstreamFolders = (
  folders: JmvstreamFolderResponse[]
): number =>
  folders.reduce(
    (sum, folder) =>
      sum +
      1 +
      countJmvstreamFolders(
        Array.isArray(folder.children) ? folder.children : []
      ),
    0
  );

export const countLocalOrphanJmvstreamFolders = async (
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

const syncCourseFolder = async ({
  courseId,
  name,
}: {
  courseId: string;
  name: string;
}): Promise<string | null> => {
  const existing = await getExistingCourseFolder(courseId);

  try {
    const client = await getConfiguredJmvstreamClient();
    const remoteFolders = await client.listFolders();
    const existingFolderUuid = existing?.folder_uuid ?? null;
    const existingFolderName = existing?.name ?? null;
    const existingRemoteFolder = existingFolderUuid
      ? findJmvstreamFolderByUuid(remoteFolders, existingFolderUuid)
      : null;
    const missingRemoteFolder = Boolean(
      existingFolderUuid && !existingRemoteFolder
    );
    let folder: { name: string; uuid: string };

    if (!existingFolderUuid || missingRemoteFolder) {
      const existingRemoteFolder = findJmvstreamFolderByName(
        remoteFolders,
        name
      );
      folder = existingRemoteFolder
        ? { name: existingRemoteFolder.name, uuid: existingRemoteFolder.uuid }
        : await client.createFolder({ name });
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

    await upsertCourseFolder({
      courseId,
      folderUuid: folder.uuid,
      lastError: missingRemoteFolder
        ? `Pasta local ${existingFolderUuid} nao existe mais na JMVStream e foi recriada.`
        : null,
      name: folder.name,
      status: "active",
    });

    return folder.uuid;
  } catch (error) {
    await upsertCourseFolder({
      courseId,
      folderUuid: existing?.folder_uuid ?? null,
      lastError: error instanceof Error ? error.message : "Erro JMVStream.",
      name,
      status: "failed",
    });

    return existing?.folder_uuid ?? null;
  }
};

const getExistingCourseFolder = async (
  courseId: string
): Promise<FolderRecord | null> => {
  const { rows } = await getPool().query<FolderRecord>(
    `
      select id, folder_uuid, name, parent_folder_uuid, status
      from jmvstream_folders
      where folder_type = 'course'
        and course_id = $1
      limit 1
    `,
    [courseId]
  );

  return rows[0] ?? null;
};

const upsertCourseFolder = async ({
  courseId,
  folderUuid,
  lastError,
  name,
  status,
}: {
  courseId: string;
  folderUuid: null | string;
  lastError: null | string;
  name: string;
  status: "active" | "failed";
}): Promise<void> => {
  const existing = await getExistingCourseFolder(courseId);

  if (existing) {
    await getPool().query(
      `
        update jmvstream_folders
        set folder_uuid = $1,
            name = $2,
            parent_folder_uuid = null,
            status = $3,
            last_error = $4,
            updated_at = now()
        where id = $5
      `,
      [folderUuid, name, status, lastError, existing.id]
    );
    return;
  }

  await getPool().query(
    `
      insert into jmvstream_folders (
        course_id, module_id, folder_uuid, folder_type, name,
        parent_folder_uuid, status, last_error
      )
      values ($1, null, $2, 'course', $3, null, $4, $5)
    `,
    [courseId, folderUuid, name, status, lastError]
  );
};

const flattenFolderUuids = (folders: JmvstreamFolderResponse[]): string[] => {
  const uuids: string[] = [];

  for (const folder of folders) {
    uuids.push(folder.uuid);
    uuids.push(...flattenFolderUuids(folder.children ?? []));
  }

  return uuids;
};
