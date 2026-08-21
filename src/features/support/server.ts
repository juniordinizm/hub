import "server-only";
import { getPool } from "@/db";
import { createSupportRequestMessage } from "@/features/outbox/rules";
import { enqueueOutboxMessage } from "@/features/outbox/server";

const SUPPORT_SUBJECT_MAX_LENGTH = 200;
const SUPPORT_MESSAGE_MAX_LENGTH = 5000;

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
