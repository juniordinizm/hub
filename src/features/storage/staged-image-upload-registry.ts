import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/db";
import {
  deleteR2Objects,
  readStagedAdminImageFile,
  verifyStagedAdminImageObject,
} from "@/features/storage/r2";
import {
  assertStagedAdminImageOwnership,
  getStagedAdminImageAggregateType,
  type StagedAdminImagePurpose,
  type StagedAdminImageReference,
} from "@/features/storage/staged-image-upload";

interface QueryResult<Row> {
  rowCount: number | null;
  rows: Row[];
}

export interface StagedImageUploadQueryable {
  query: <Row = Record<string, unknown>>(
    sql: string,
    values?: unknown[]
  ) => Promise<QueryResult<Row>>;
}

const getQueryable = (
  queryable?: StagedImageUploadQueryable
): StagedImageUploadQueryable => queryable ?? getPool();

const assertClaimUpdated = (rowCount: number | null): void => {
  if (rowCount !== 1) {
    throw new Error("O upload temporario ja foi utilizado ou expirou.");
  }
};

export const registerStagedAdminImageUpload = async ({
  actorUserId,
  queryable,
  reference,
}: {
  actorUserId: string;
  queryable?: StagedImageUploadQueryable;
  reference: StagedAdminImageReference;
}): Promise<void> => {
  assertStagedAdminImageOwnership({
    actorUserId,
    aggregateId: reference.aggregateId,
    purpose: reference.purpose,
    reference,
  });
  const result = await getQueryable(queryable).query(
    `
      insert into staged_admin_image_uploads (
        object_key,
        actor_user_id,
        aggregate_type,
        aggregate_id,
        purpose,
        content_type,
        file_name,
        size_bytes
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (object_key) do nothing
    `,
    [
      reference.key,
      actorUserId,
      getStagedAdminImageAggregateType(reference.purpose),
      reference.aggregateId,
      reference.purpose,
      reference.contentType,
      reference.fileName,
      reference.sizeBytes,
    ]
  );
  assertClaimUpdated(result.rowCount);
};

export const confirmStagedAdminImageUpload = async ({
  actorUserId,
  queryable,
  reference,
}: {
  actorUserId: string;
  queryable?: StagedImageUploadQueryable;
  reference: StagedAdminImageReference;
}): Promise<void> => {
  assertStagedAdminImageOwnership({
    actorUserId,
    aggregateId: reference.aggregateId,
    purpose: reference.purpose,
    reference,
  });
  await verifyStagedAdminImageObject(reference);
  const result = await getQueryable(queryable).query(
    `
      update staged_admin_image_uploads
      set status = 'ready',
          confirmed_at = coalesce(confirmed_at, now()),
          updated_at = now()
      where object_key = $1
        and actor_user_id = $2
        and aggregate_id = $3
        and purpose = $4
        and content_type = $5
        and file_name = $6
        and size_bytes = $7
        and status in ('prepared', 'ready')
        and expires_at > now()
    `,
    [
      reference.key,
      actorUserId,
      reference.aggregateId,
      reference.purpose,
      reference.contentType,
      reference.fileName,
      reference.sizeBytes,
    ]
  );
  assertClaimUpdated(result.rowCount);
};

export const claimStagedAdminImageUpload = async ({
  actorUserId,
  aggregateId,
  purpose,
  queryable,
  reference,
}: {
  actorUserId: string;
  aggregateId: string;
  purpose: StagedAdminImagePurpose;
  queryable?: StagedImageUploadQueryable;
  reference: StagedAdminImageReference;
}): Promise<string> => {
  assertStagedAdminImageOwnership({
    actorUserId,
    aggregateId,
    purpose,
    reference,
  });
  const ownerToken = randomUUID();
  const result = await getQueryable(queryable).query<{
    owner_token: string;
  }>(
    `
      update staged_admin_image_uploads
      set status = 'processing',
          owner_token = $8,
          locked_at = now(),
          updated_at = now()
      where object_key = $1
        and actor_user_id = $2
        and aggregate_id = $3
        and purpose = $4
        and content_type = $5
        and file_name = $6
        and size_bytes = $7
        and (
          status = 'ready'
          or (
            status = 'processing'
            and locked_at < now() - interval '15 minutes'
          )
        )
        and expires_at > now()
      returning owner_token
    `,
    [
      reference.key,
      actorUserId,
      aggregateId,
      purpose,
      reference.contentType,
      reference.fileName,
      reference.sizeBytes,
      ownerToken,
    ]
  );
  const claimedOwnerToken = result.rows[0]?.owner_token;
  if (!claimedOwnerToken) {
    throw new Error("O upload temporario ja foi utilizado ou expirou.");
  }
  return claimedOwnerToken;
};

export const completeStagedAdminImageUpload = async ({
  objectKey,
  ownerToken,
  queryable,
}: {
  objectKey: string;
  ownerToken: string;
  queryable?: StagedImageUploadQueryable;
}): Promise<void> => {
  const result = await getQueryable(queryable).query(
    `
      update staged_admin_image_uploads
      set status = 'consumed',
          owner_token = null,
          locked_at = null,
          consumed_at = now(),
          updated_at = now()
      where object_key = $1
        and status = 'processing'
        and owner_token = $2
    `,
    [objectKey, ownerToken]
  );
  assertClaimUpdated(result.rowCount);
};

export const releaseStagedAdminImageUpload = async ({
  objectKey,
  ownerToken,
  queryable,
}: {
  objectKey: string;
  ownerToken: string;
  queryable?: StagedImageUploadQueryable;
}): Promise<void> => {
  await getQueryable(queryable).query(
    `
      update staged_admin_image_uploads
      set status = 'ready',
          owner_token = null,
          locked_at = null,
          updated_at = now()
      where object_key = $1
        and status = 'processing'
        and owner_token = $2
    `,
    [objectKey, ownerToken]
  );
};

interface StagedAdminImageConsumption {
  purpose: StagedAdminImagePurpose;
  reference: StagedAdminImageReference;
}

interface ClaimedStagedAdminImage extends StagedAdminImageConsumption {
  ownerToken: string;
}

const releaseClaimedStagedAdminImages = async (
  claimed: ClaimedStagedAdminImage[]
): Promise<void> => {
  await Promise.all(
    claimed.map(({ ownerToken, reference }) =>
      releaseStagedAdminImageUpload({
        objectKey: reference.key,
        ownerToken,
      })
    )
  );
};

const completeClaimedStagedAdminImages = async (
  claimed: ClaimedStagedAdminImage[]
): Promise<void> => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    for (const { ownerToken, reference } of claimed) {
      await completeStagedAdminImageUpload({
        objectKey: reference.key,
        ownerToken,
        queryable: client,
      });
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const consumeStagedAdminImageUploads = async <Result>({
  actorUserId,
  aggregateId,
  operation,
  uploads,
}: {
  actorUserId: string;
  aggregateId: string;
  operation: (files: File[]) => Promise<Result>;
  uploads: StagedAdminImageConsumption[];
}): Promise<Result> => {
  const claimed: ClaimedStagedAdminImage[] = [];
  try {
    for (const upload of uploads) {
      const ownerToken = await claimStagedAdminImageUpload({
        actorUserId,
        aggregateId,
        purpose: upload.purpose,
        reference: upload.reference,
      });
      claimed.push({ ...upload, ownerToken });
    }
  } catch (error) {
    await releaseClaimedStagedAdminImages(claimed);
    throw error;
  }

  let operationCompleted = false;
  try {
    const files = await Promise.all(
      claimed.map(({ purpose, reference }) =>
        readStagedAdminImageFile({
          actorUserId,
          aggregateId,
          purpose,
          reference,
        })
      )
    );
    const result = await operation(files);
    operationCompleted = true;
    await completeClaimedStagedAdminImages(claimed);
    await deleteR2Objects(claimed.map(({ reference }) => reference.key)).catch(
      () => undefined
    );
    return result;
  } catch (error) {
    if (!operationCompleted) {
      await releaseClaimedStagedAdminImages(claimed);
    }
    throw error;
  }
};

export const consumeStagedAdminImageUpload = async <Result>({
  actorUserId,
  aggregateId,
  operation,
  purpose,
  reference,
}: {
  actorUserId: string;
  aggregateId: string;
  operation: (file: File) => Promise<Result>;
  purpose: StagedAdminImagePurpose;
  reference: StagedAdminImageReference;
}): Promise<Result> =>
  await consumeStagedAdminImageUploads({
    actorUserId,
    aggregateId,
    operation: async ([file]) => {
      if (!file) {
        throw new Error("O upload temporario nao foi encontrado.");
      }
      return await operation(file);
    },
    uploads: [{ purpose, reference }],
  });
