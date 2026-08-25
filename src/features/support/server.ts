import "server-only";
import { getPool } from "@/db";
import { createSupportRequestMessage } from "@/features/outbox/rules";
import { enqueueOutboxMessage } from "@/features/outbox/server";

const SUPPORT_SUBJECT_MAX_LENGTH = 160;
const SUPPORT_MESSAGE_MAX_LENGTH = 1800;
const SUPPORT_REQUEST_WINDOW_MINUTES = 10;
const SUPPORT_REQUEST_MAX_PER_WINDOW = 3;

const normalizeTextField = (value: string, maxLength: number): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("Informe assunto e mensagem para o suporte.");
  }
  if (normalized.length > maxLength) {
    throw new Error("Campo de suporte excede o tamanho permitido.");
  }
  return normalized;
};

export const createSupportRequest = async ({
  courseTitle,
  message,
  subject,
  userId,
}: {
  courseTitle?: string;
  message: string;
  subject: string;
  userId: string;
}): Promise<void> => {
  const normalizedSubject = normalizeTextField(
    subject,
    SUPPORT_SUBJECT_MAX_LENGTH
  );
  const normalizedMessage = normalizeTextField(
    message,
    SUPPORT_MESSAGE_MAX_LENGTH
  );
  const normalizedCourseTitle = courseTitle?.trim() || null;

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`support-request:${userId}`]
    );
    const recentRequests = await client.query<{ count: string }>(
      `
        select count(*) as count
        from support_requests
        where user_id = $1
          and created_at > now() - (${SUPPORT_REQUEST_WINDOW_MINUTES} * interval '1 minute')
      `,
      [userId]
    );
    const recentCount = Number(recentRequests.rows[0]?.count ?? 0);
    if (recentCount >= SUPPORT_REQUEST_MAX_PER_WINDOW) {
      throw new Error(
        "Aguarde alguns minutos antes de enviar outra mensagem de suporte."
      );
    }
    const { rows } = await client.query<{ id: string }>(
      `
        insert into support_requests (
          user_id,
          subject,
          message,
          course_title
        )
        values ($1, $2, $3, $4)
        returning id
      `,
      [userId, normalizedSubject, normalizedMessage, normalizedCourseTitle]
    );
    const requestId = rows[0]?.id;
    if (!requestId) {
      throw new Error("Nao foi possivel registrar o pedido de suporte.");
    }
    await enqueueOutboxMessage({
      client,
      message: createSupportRequestMessage({ requestId }),
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};
