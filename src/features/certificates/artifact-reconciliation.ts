import "server-only";
import { getPool } from "@/db";
import { OUTBOX_TOPICS } from "@/features/outbox/rules";
import { deleteR2Objects } from "@/features/storage/r2";
import { CERTIFICATE_RENDER_CLAIM_LEASE_MINUTES } from "./rules";

const RECONCILIATION_BATCH_LIMIT = 100;

const REVOKED_ORPHAN_PREDICATE = `
  certificate.status = 'revoked'
  and certificate.pdf_storage_key is null
  and certificate.render_status in ('pending', 'failed')
  and certificate.render_claim_token is null
  and certificate.updated_at < now() - ($2 * interval '1 minute')
  and not exists (
    select 1
    from outbox_messages message
    where message.aggregate_id = certificate.id::text
      and message.topic = $3
      and message.status = 'processing'
  )
  and not exists (
    select 1
    from audit_logs audit
    where audit.action = 'certificate.artifact_reconciled'
      and audit.target_type = 'certificate'
      and audit.target_id = certificate.id::text
  )
`;

export const reconcileRevokedCertificateArtifacts =
  async (): Promise<number> => {
    const pool = getPool();

    await pool.query(
      `update certificates
     set render_claim_token = null,
         render_claimed_at = null,
         updated_at = now()
     where status = 'revoked'
       and render_claim_token is not null
       and render_claimed_at < now() - ($1 * interval '1 minute')`,
      [CERTIFICATE_RENDER_CLAIM_LEASE_MINUTES]
    );

    const candidates = await pool.query<{ id: string }>(
      `select certificate.id
     from certificates certificate
     where ${REVOKED_ORPHAN_PREDICATE}
     order by certificate.updated_at asc
     limit $1`,
      [
        RECONCILIATION_BATCH_LIMIT,
        CERTIFICATE_RENDER_CLAIM_LEASE_MINUTES,
        OUTBOX_TOPICS.certificateRender,
      ]
    );

    let reconciled = 0;
    for (const candidate of candidates.rows) {
      const verification = await pool.query<{ id: string }>(
        `select certificate.id
       from certificates certificate
       where certificate.id = $1
         and ${REVOKED_ORPHAN_PREDICATE}
       limit 1`,
        [
          candidate.id,
          CERTIFICATE_RENDER_CLAIM_LEASE_MINUTES,
          OUTBOX_TOPICS.certificateRender,
        ]
      );
      if (!verification.rows[0]) {
        continue;
      }

      await deleteR2Objects([`certificates/${candidate.id}/certificate.pdf`]);
      await pool.query(
        `insert into audit_logs (action, target_type, target_id, metadata)
       values (
         'certificate.artifact_reconciled',
         'certificate',
         $1,
         '{"artifact":"pdf"}'::jsonb
       )`,
        [candidate.id]
      );
      reconciled += 1;
    }

    return reconciled;
  };
