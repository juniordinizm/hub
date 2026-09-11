import { getPool } from "@/db";
import type { AuditMetadata } from "./audit-types";

export interface AuditLogQueryClient {
  query: (sql: string, values?: unknown[]) => Promise<unknown>;
}

export const writeAuditLog = async ({
  action,
  actorUserId,
  client = getPool(),
  metadata = {},
  targetId,
  targetType,
}: {
  action: string;
  actorUserId?: string | null;
  client?: AuditLogQueryClient | undefined;
  metadata?: AuditMetadata | undefined;
  targetId?: string | null | undefined;
  targetType: string;
}): Promise<void> => {
  await client.query(
    `
      insert into audit_logs (
        actor_user_id,
        action,
        target_type,
        target_id,
        metadata
      )
      values ($1, $2, $3, $4, $5::jsonb)
    `,
    [
      actorUserId ?? null,
      action,
      targetType,
      targetId ?? null,
      JSON.stringify(metadata),
    ]
  );
};
