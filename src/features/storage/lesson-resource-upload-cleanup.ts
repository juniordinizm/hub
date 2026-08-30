import "server-only";
import { getPool } from "@/db";
import { deleteR2Objects } from "@/features/storage/r2";

const CLEANUP_GRACE_MS = 24 * 60 * 60 * 1000;
const CLEANUP_LIMIT = 100;

interface ExpiredLessonResourceUpload {
  object_key: string;
  preview_object_key: string | null;
  resource_id: string;
}

export const reconcileExpiredLessonResourceUploads = async ({
  now = new Date(),
  shouldContinue = async () => true,
}: {
  now?: Date;
  shouldContinue?: () => Promise<boolean>;
} = {}): Promise<number> => {
  const pool = getPool();
  const olderThan = new Date(now.getTime() - CLEANUP_GRACE_MS);
  const candidates = await pool.query<ExpiredLessonResourceUpload>(
    `
      select resource_id, object_key, preview_object_key
      from staged_lesson_resource_uploads
      where expires_at <= $1
        and status in ('prepared', 'uploaded', 'cleaning')
      order by expires_at asc
      limit $2
    `,
    [olderThan, CLEANUP_LIMIT]
  );

  let removed = 0;
  for (const candidate of candidates.rows) {
    if (!(await shouldContinue())) {
      break;
    }

    const claimed = await pool.query(
      `
        update staged_lesson_resource_uploads
        set status = 'cleaning',
            updated_at = now()
        where resource_id = $1
          and expires_at <= $2
          and status in ('prepared', 'uploaded', 'cleaning')
      `,
      [candidate.resource_id, olderThan]
    );
    if (claimed.rowCount !== 1) {
      continue;
    }

    const referenceState = await pool.query<{ referenced: boolean }>(
      `
        select exists (
          select 1
          from lessons
          where content_json @> jsonb_build_object(
            'resources',
            jsonb_build_array(jsonb_build_object('key', $1::text))
          )
        ) as referenced
      `,
      [candidate.object_key]
    );
    const objectKeys = [
      candidate.object_key,
      ...(candidate.preview_object_key ? [candidate.preview_object_key] : []),
    ];

    if (referenceState.rows[0]?.referenced) {
      await pool.query(
        `
          delete from staged_lesson_resource_uploads
          where resource_id = $1
            and expires_at <= $2
            and status = 'cleaning'
        `,
        [candidate.resource_id, olderThan]
      );
      continue;
    }

    if (!(await shouldContinue())) {
      break;
    }
    try {
      await deleteR2Objects(objectKeys);
    } catch {
      continue;
    }

    const deleted = await pool.query(
      `
          delete from staged_lesson_resource_uploads
          where resource_id = $1
            and expires_at <= $2
            and status = 'cleaning'
        `,
      [candidate.resource_id, olderThan]
    );
    removed += deleted.rowCount ?? 0;
  }

  if (await shouldContinue()) {
    await pool.query(
      `
        delete from staged_lesson_resource_uploads
        where status = 'consumed'
          and expires_at <= $1
      `,
      [olderThan]
    );
  }

  return removed;
};
