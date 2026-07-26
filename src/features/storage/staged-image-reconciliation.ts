import "server-only";
import { getPool } from "@/db";
import { deleteExpiredStagedAdminImages } from "@/features/storage/r2";

const STAGED_UPLOAD_RETENTION_MS = 24 * 60 * 60 * 1000;

export const reconcileStagedAdminImageUploads = async ({
  now = new Date(),
  shouldContinue = async () => true,
}: {
  now?: Date;
  shouldContinue?: () => Promise<boolean>;
} = {}): Promise<number> => {
  const removed = await deleteExpiredStagedAdminImages({
    olderThan: new Date(now.getTime() - STAGED_UPLOAD_RETENTION_MS),
    shouldContinue,
  });
  if (await shouldContinue()) {
    await getPool().query(
      `
        delete from staged_admin_image_uploads
        where expires_at <= $1
          and (
            status <> 'processing'
            or locked_at < $1 - interval '15 minutes'
          )
      `,
      [now]
    );
  }
  return removed;
};
