import "server-only";
import { getPool } from "@/db";
import { renderPendingCertificate } from "@/features/certificates/server";
import {
  sendAccessExpiryWarningEmail,
  sendAccessReleasedEmail,
  sendCertificateIssuedEmail,
} from "@/features/email/server";
import {
  createCertificateIssuedMessage,
  OUTBOX_TOPICS,
  type OutboxPayload,
  parseOutboxPayload,
} from "./rules";
import { enqueueOutboxMessage } from "./server";
import { type ClaimedOutboxMessage, OutboxDeliveryError } from "./worker";

const unavailableAggregate = (): OutboxDeliveryError =>
  new OutboxDeliveryError("aggregate_not_deliverable", { retryable: false });

const deliveryFailure = (): OutboxDeliveryError =>
  new OutboxDeliveryError("resend_delivery_failed", { retryable: true });

const getCertificateDeliveryData = async (certificateId: string) => {
  const result = await getPool().query<{
    certificate_code: string;
    course_title: string;
    student_email: string;
    student_name: string;
  }>(
    `
      select
        certificates.code as certificate_code,
        certificates.course_title_snapshot as course_title,
        users.email as student_email,
        certificates.student_name_snapshot as student_name
      from certificates
      join users on users.id = certificates.user_id
      where certificates.id = $1 and certificates.status = 'valid' and certificates.render_status = 'ready'
      limit 1
    `,
    [certificateId]
  );
  return result.rows[0] ?? null;
};

const getAccessReleasedDeliveryData = async ({
  courseId,
  userId,
}: {
  courseId: string;
  userId: string;
}) => {
  const result = await getPool().query<{
    course_title: string;
    student_email: string;
    student_name: string;
  }>(
    `
      select
        courses.title as course_title,
        users.email as student_email,
        users.name as student_name
      from enrollments
      join users on users.id = enrollments.user_id
      join courses on courses.id = enrollments.course_id
      where enrollments.user_id = $1
        and enrollments.course_id = $2
        and enrollments.status = 'active'
      limit 1
    `,
    [userId, courseId]
  );
  return result.rows[0] ?? null;
};

const getExpiryWarningDeliveryData = async (enrollmentId: string) => {
  const result = await getPool().query<{
    course_id: string;
    course_title: string;
    student_email: string;
    student_name: string;
  }>(
    `
      select
        courses.id as course_id,
        courses.title as course_title,
        users.email as student_email,
        users.name as student_name
      from enrollments
      join users on users.id = enrollments.user_id
      join courses on courses.id = enrollments.course_id
      where enrollments.id = $1 and enrollments.status = 'active'
      limit 1
    `,
    [enrollmentId]
  );
  return result.rows[0] ?? null;
};

const deliverCertificateRender = async (
  certificateId: string
): Promise<void> => {
  await renderPendingCertificate(certificateId);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await enqueueOutboxMessage({
      client,
      message: createCertificateIssuedMessage({ certificateId }),
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const deliverOutboxMessage = async (
  message: ClaimedOutboxMessage
): Promise<void> => {
  let payload: OutboxPayload;
  try {
    payload = parseOutboxPayload(message);
  } catch {
    throw new OutboxDeliveryError("unknown_payload_version", {
      retryable: false,
    });
  }

  try {
    if (
      message.topic === OUTBOX_TOPICS.certificateRender &&
      "certificateId" in payload
    ) {
      await deliverCertificateRender(payload.certificateId);
      return;
    }

    if (
      message.topic === OUTBOX_TOPICS.certificateIssued &&
      "certificateId" in payload
    ) {
      const data = await getCertificateDeliveryData(payload.certificateId);
      if (!data) {
        throw unavailableAggregate();
      }
      await sendCertificateIssuedEmail({
        certificateCode: data.certificate_code,
        courseTitle: data.course_title,
        idempotencyKey: message.idempotencyKey,
        to: data.student_email,
        userName: data.student_name,
      });
      return;
    }

    if (
      message.topic === OUTBOX_TOPICS.accessReleased &&
      "courseId" in payload &&
      "userId" in payload
    ) {
      const data = await getAccessReleasedDeliveryData(payload);
      if (!data) {
        throw unavailableAggregate();
      }
      await sendAccessReleasedEmail({
        courseId: payload.courseId,
        courseTitle: data.course_title,
        idempotencyKey: message.idempotencyKey,
        to: data.student_email,
        userName: data.student_name,
      });
      return;
    }

    if (
      message.topic === OUTBOX_TOPICS.accessExpiryWarning &&
      "enrollmentId" in payload &&
      "warningKind" in payload
    ) {
      const data = await getExpiryWarningDeliveryData(payload.enrollmentId);
      if (!data) {
        throw unavailableAggregate();
      }
      await sendAccessExpiryWarningEmail({
        courseId: data.course_id,
        courseTitle: data.course_title,
        daysRemaining: payload.warningKind === "1d" ? 1 : 7,
        idempotencyKey: message.idempotencyKey,
        to: data.student_email,
        userName: data.student_name,
      });
      return;
    }
  } catch (error) {
    if (error instanceof OutboxDeliveryError) {
      throw error;
    }
    throw deliveryFailure();
  }

  throw new OutboxDeliveryError("unknown_payload_version", {
    retryable: false,
  });
};
