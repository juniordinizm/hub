import "server-only";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { getPool } from "@/db";
import { deleteR2Objects } from "@/features/storage/r2";

type QueryClient = Pick<Pool, "query">;

const CLEANUP_DELAY_MS = 24 * 60 * 60 * 1000;
const CLEANUP_LEASE_MINUTES = 10;
const DEFAULT_CLEANUP_LIMIT = 50;

const uniqueKeys = (keys: string[]): string[] =>
  Array.from(new Set(keys.filter(Boolean)));

export const queueCertificateTemplateAssetCleanup = async ({
  client,
  courseId,
  delayMs = CLEANUP_DELAY_MS,
  keys,
}: {
  client: QueryClient;
  courseId: string;
  delayMs?: number;
  keys: string[];
}): Promise<void> => {
  const candidates = uniqueKeys(keys);
  if (candidates.length === 0) {
    return;
  }

  await client.query(
    `
      insert into certificate_template_asset_cleanup (
        object_key,
        course_id,
        status,
        not_before
      )
      select
        candidate.key,
        $2::uuid,
        'pending',
        now() + ($3 * interval '1 millisecond')
      from unnest($1::text[]) as candidate(key)
      where not exists (
        select 1
        from certificate_templates template
        where template.background_key = candidate.key
           or template.signature_key = candidate.key
      )
      and not exists (
        select 1
        from certificates certificate
        where certificate.render_snapshot #>> '{template,backgroundKey}' = candidate.key
           or certificate.render_snapshot #>> '{template,signatureKey}' = candidate.key
      )
      on conflict (object_key) do nothing
    `,
    [candidates, courseId, delayMs]
  );
};

export const prepareCertificateTemplateAssetReferences = async ({
  client,
  keys,
}: {
  client: QueryClient;
  keys: string[];
}): Promise<boolean> => {
  const references = uniqueKeys(keys);
  if (references.length === 0) {
    return true;
  }

  const cleanupStates = await client.query<{ status: string }>(
    `
      select status
      from certificate_template_asset_cleanup
      where object_key = any($1::text[])
      for update
    `,
    [references]
  );
  if (cleanupStates.rows.some(({ status }) => status !== "pending")) {
    return false;
  }

  await client.query(
    `
      delete from certificate_template_asset_cleanup
      where object_key = any($1::text[]) and status = 'pending'
    `,
    [references]
  );
  return true;
};

export const scheduleCertificateTemplateAssetCleanup = async ({
  courseId,
  keys,
}: {
  courseId: string;
  keys: string[];
}): Promise<void> => {
  if (uniqueKeys(keys).length === 0) {
    return;
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      [courseId]
    );
    await queueCertificateTemplateAssetCleanup({
      client,
      courseId,
      keys,
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

interface ClaimedTemplateAsset {
  objectKey: string;
}

export const reconcileCertificateTemplateAssets = async ({
  limit = DEFAULT_CLEANUP_LIMIT,
  ownerToken = randomUUID(),
  shouldContinue = async () => true,
}: {
  limit?: number;
  ownerToken?: string;
  shouldContinue?: () => Promise<boolean>;
} = {}): Promise<number> => {
  const pool = getPool();
  const claimed = await pool.query<ClaimedTemplateAsset>(
    `
      with candidates as (
        select object_key
        from certificate_template_asset_cleanup
        where (
          status = 'pending' and not_before <= now()
        ) or (
          status = 'processing'
          and locked_at < now() - ($3 * interval '1 minute')
        )
        order by not_before asc, created_at asc
        for update skip locked
        limit $2
      )
      update certificate_template_asset_cleanup as cleanup
      set status = 'processing',
          owner_token = $1::uuid,
          locked_at = now(),
          attempts = cleanup.attempts + 1,
          updated_at = now()
      from candidates
      where cleanup.object_key = candidates.object_key
      returning cleanup.object_key as "objectKey"
    `,
    [ownerToken, limit, CLEANUP_LEASE_MINUTES]
  );

  let removed = 0;
  for (const candidate of claimed.rows) {
    if (!(await shouldContinue())) {
      break;
    }
    const state = await pool.query<{
      owned: boolean;
      referenced: boolean;
    }>(
      `
        select
          cleanup.status = 'processing'
            and cleanup.owner_token = $2::uuid as owned,
          exists (
            select 1
            from certificate_templates template
            where template.background_key = cleanup.object_key
               or template.signature_key = cleanup.object_key
          ) or exists (
            select 1
            from certificates certificate
            where certificate.render_snapshot #>> '{template,backgroundKey}' = cleanup.object_key
               or certificate.render_snapshot #>> '{template,signatureKey}' = cleanup.object_key
          ) as referenced
        from certificate_template_asset_cleanup cleanup
        where cleanup.object_key = $1
      `,
      [candidate.objectKey, ownerToken]
    );
    const current = state.rows[0];
    if (!current?.owned) {
      continue;
    }
    if (current.referenced) {
      await pool.query(
        `
          delete from certificate_template_asset_cleanup
          where object_key = $1 and owner_token = $2::uuid
        `,
        [candidate.objectKey, ownerToken]
      );
      continue;
    }

    if (!(await shouldContinue())) {
      break;
    }
    try {
      await deleteR2Objects([candidate.objectKey]);
    } catch {
      await pool.query(
        `
          update certificate_template_asset_cleanup
          set last_error_code = 'r2_delete_failed',
              last_error_at = now(),
              updated_at = now()
          where object_key = $1 and owner_token = $2::uuid
        `,
        [candidate.objectKey, ownerToken]
      );
      continue;
    }

    const completed = await pool.query(
      `
        update certificate_template_asset_cleanup
        set status = 'deleted',
            owner_token = null,
            locked_at = null,
            deleted_at = now(),
            last_error_code = null,
            last_error_at = null,
            updated_at = now()
        where object_key = $1
          and status = 'processing'
          and owner_token = $2::uuid
      `,
      [candidate.objectKey, ownerToken]
    );
    removed += completed.rowCount ?? 0;
  }

  return removed;
};
