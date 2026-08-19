import { getPool } from "@/db";
import { normalizeBuyerEmail } from "./buyer-identity";

export interface BuyerIdentityAuditCandidate {
  email: string;
  userId: string;
}

export interface BuyerIdentityCollision {
  canonicalEmail: string;
  originalEmails: string[];
  userIds: string[];
}

const DEFAULT_AUDIT_BATCH_SIZE = 500;
const MAX_AUDIT_BATCH_SIZE = 1000;
const MAX_AUDIT_BATCHES = 1000;

export const findBuyerIdentityCollisions = (
  candidates: readonly BuyerIdentityAuditCandidate[]
): BuyerIdentityCollision[] => {
  const groups = new Map<string, BuyerIdentityCollision>();

  for (const candidate of candidates) {
    const canonicalEmail = normalizeBuyerEmail(candidate.email);
    const current = groups.get(canonicalEmail);
    if (current) {
      current.originalEmails.push(candidate.email);
      current.userIds.push(candidate.userId);
      continue;
    }

    groups.set(canonicalEmail, {
      canonicalEmail,
      originalEmails: [candidate.email],
      userIds: [candidate.userId],
    });
  }

  return [...groups.values()]
    .filter((collision) => collision.userIds.length > 1)
    .sort((left, right) =>
      left.canonicalEmail.localeCompare(right.canonicalEmail)
    );
};

export const scanBuyerIdentityCollisions = async ({
  batchSize = DEFAULT_AUDIT_BATCH_SIZE,
}: {
  batchSize?: number;
} = {}): Promise<BuyerIdentityCollision[]> => {
  const boundedBatchSize = Math.min(
    MAX_AUDIT_BATCH_SIZE,
    Math.max(1, Math.trunc(batchSize))
  );
  const candidates: BuyerIdentityAuditCandidate[] = [];
  let cursor = "";

  for (let batch = 0; batch < MAX_AUDIT_BATCHES; batch += 1) {
    const { rows } = await getPool().query<{
      email: string;
      user_id: string;
    }>(
      `
        select id as user_id, email
        from users
        where id::text > $1
        order by id::text asc
        limit $2
      `,
      [cursor, boundedBatchSize]
    );

    if (rows.length === 0) {
      break;
    }

    candidates.push(
      ...rows.map((row) => ({ email: row.email, userId: row.user_id }))
    );
    const nextCursor = rows.at(-1)?.user_id;
    if (!nextCursor || nextCursor === cursor) {
      throw new Error("A auditoria de identidade não avançou o cursor.");
    }
    cursor = nextCursor;

    if (rows.length < boundedBatchSize) {
      break;
    }
  }

  return findBuyerIdentityCollisions(candidates);
};
