import "server-only";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { getPool } from "@/db";
import type {
  AsaasCustomerMapping,
  AsaasCustomerMappingRepository,
} from "./asaas-customer-resolution";

interface MappingRow {
  external_reference: string;
  id: string;
  provider_customer_id: string | null;
  status: AsaasCustomerMapping["status"];
}

const mapRow = (row: MappingRow): AsaasCustomerMapping => ({
  externalReference: row.external_reference,
  id: row.id,
  providerCustomerId: row.provider_customer_id,
  status: row.status,
});

const selection = `
  select id, external_reference, provider_customer_id, status
  from asaas_customer_mappings
`;

export class PostgresAsaasCustomerMappingRepository
  implements AsaasCustomerMappingRepository
{
  private readonly pool: Pool;

  constructor(pool: Pool = getPool()) {
    this.pool = pool;
  }

  async reserve({
    fingerprint,
    normalizedEmail,
  }: {
    fingerprint: string;
    normalizedEmail: string;
  }): Promise<AsaasCustomerMapping> {
    const externalReference = `buyer_${randomUUID()}`;
    await this.pool.query(
      `
        insert into asaas_customer_mappings (
          provider, identity_fingerprint, normalized_email,
          external_reference, status
        )
        values ('asaas', $1, $2, $3, 'pending')
        on conflict (provider, identity_fingerprint, normalized_email)
        do nothing
      `,
      [fingerprint, normalizedEmail, externalReference]
    );
    const result = await this.pool.query<MappingRow>(
      `${selection}
       where provider = 'asaas'
         and identity_fingerprint = $1
         and normalized_email = $2
       limit 1`,
      [fingerprint, normalizedEmail]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error("Mapeamento de cliente nao foi reservado.");
    }
    return mapRow(row);
  }

  async claimCreating(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `
        update asaas_customer_mappings
        set status = 'creating',
            attempt_count = attempt_count + 1,
            last_attempt_at = now(),
            error_message = null,
            updated_at = now()
        where id = $1
          and (
            status in ('pending', 'uncertain', 'failed')
            or (status = 'creating' and last_attempt_at < now() - interval '5 minutes')
          )
        returning id
      `,
      [id]
    );
    return Boolean(result.rows[0]);
  }

  async read(id: string): Promise<AsaasCustomerMapping | null> {
    const result = await this.pool.query<MappingRow>(
      `${selection} where id = $1 limit 1`,
      [id]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async markReady(
    id: string,
    providerCustomerId: string
  ): Promise<AsaasCustomerMapping> {
    const result = await this.pool.query<MappingRow>(
      `
        update asaas_customer_mappings
        set status = 'ready', provider_customer_id = $2,
            error_message = null, updated_at = now()
        where id = $1 and status = 'creating'
        returning id, external_reference, provider_customer_id, status
      `,
      [id, providerCustomerId]
    );
    const row = result.rows[0];
    if (!row) {
      const current = await this.read(id);
      if (current?.status === "ready") {
        return current;
      }
      throw new Error("Estado do cliente Asaas mudou durante a criacao.");
    }
    return mapRow(row);
  }

  async markUncertain(id: string): Promise<void> {
    await this.setFailureState(id, "uncertain", "asaas_customer_unknown");
  }

  async markFailed(id: string): Promise<void> {
    await this.setFailureState(id, "failed", "asaas_customer_rejected");
  }

  private async setFailureState(
    id: string,
    status: "failed" | "uncertain",
    errorMessage: string
  ): Promise<void> {
    await this.pool.query(
      `
        update asaas_customer_mappings
        set status = $2, error_message = $3, updated_at = now()
        where id = $1 and status = 'creating'
      `,
      [id, status, errorMessage]
    );
  }
}
