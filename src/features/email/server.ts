import "server-only";
import { render } from "@react-email/components";
import { Resend } from "resend";
import { assertDevelopmentEmailRecipientAllowed } from "@/features/email/development-recipient";
import {
  AccessExpiryWarningEmail,
  AccessReleasedEmail,
  CertificateIssuedEmail,
  CourseSalesOpenedEmail,
  PasswordResetEmail,
  SupportRequestEmail,
} from "@/features/email/templates";
import { isAccountActivationEmailIdempotencyKey } from "@/lib/account-activation-idempotency";
import { getServerEnv } from "@/lib/env";

interface SendEmailInput {
  idempotencyKey?: string;
  react: React.ReactNode;
  replyTo?: string;
  subject: string;
  to: string;
}

export const sendTransactionalEmail = async ({
  idempotencyKey,
  react,
  replyTo,
  subject,
  to,
}: SendEmailInput): Promise<void> => {
  const env = getServerEnv();

  if (env.E2E_TEST_MODE) {
    return;
  }

  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is required to send transactional email.");
  }

  assertDevelopmentEmailRecipientAllowed({
    allowlist: env.DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST,
    environment: env.NODE_ENV,
    recipient: to,
  });

  const resolvedReplyTo = replyTo ?? env.SUPPORT_EMAIL;
  const html = await render(react);
  const email = {
    from: env.RESEND_FROM_EMAIL,
    html,
    ...(resolvedReplyTo ? { replyTo: resolvedReplyTo } : {}),
    subject,
    to,
  };
  const { error } = await new Resend(env.RESEND_API_KEY).emails.send(
    email,
    ...(idempotencyKey ? [{ idempotencyKey }] : [])
  );

  const activationEmailAlreadyAccepted =
    error?.name === "invalid_idempotent_request" &&
    Boolean(
      idempotencyKey &&
        isAccountActivationEmailIdempotencyKey({
          authSecret: env.BETTER_AUTH_SECRET,
          value: idempotencyKey,
        })
    );

  if (error && !activationEmailAlreadyAccepted) {
    throw new Error(error.message);
  }
};

export const sendPasswordResetEmail = async ({
  idempotencyKey,
  resetUrl,
  to,
  userName,
}: {
  idempotencyKey?: string;
  resetUrl: string;
  to: string;
  userName: string;
}): Promise<void> =>
  sendTransactionalEmail({
    ...(idempotencyKey ? { idempotencyKey } : {}),
    react: PasswordResetEmail({ actionUrl: resetUrl, name: userName }),
    subject: "Criar ou redefinir senha do PROTEA-R Hub",
    to,
  });

export const sendAccessReleasedEmail = async ({
  courseId,
  courseTitle,
  idempotencyKey,
  to,
  userName,
}: {
  courseId?: string;
  courseTitle: string;
  idempotencyKey?: string;
  to: string;
  userName: string;
}): Promise<void> =>
  sendTransactionalEmail({
    ...(idempotencyKey ? { idempotencyKey } : {}),
    react: AccessReleasedEmail({
      actionUrl: `${getServerEnv().NEXT_PUBLIC_APP_URL}${
        courseId ? `/app/cursos/${courseId}` : "/app"
      }`,
      courseTitle,
      name: userName,
      resetUrl: `${getServerEnv().NEXT_PUBLIC_APP_URL}/recuperar-senha`,
    }),
    subject: "Acesso liberado no PROTEA-R Hub",
    to,
  });

export const sendAccessExpiryWarningEmail = async ({
  courseId,
  courseTitle,
  daysRemaining,
  idempotencyKey,
  to,
  userName,
}: {
  courseId: string;
  courseTitle: string;
  daysRemaining: number;
  idempotencyKey?: string;
  to: string;
  userName: string;
}): Promise<void> =>
  sendTransactionalEmail({
    ...(idempotencyKey ? { idempotencyKey } : {}),
    react: AccessExpiryWarningEmail({
      actionUrl: `${getServerEnv().NEXT_PUBLIC_APP_URL}/app/cursos/${courseId}`,
      courseTitle,
      daysRemaining,
      name: userName,
    }),
    subject: `Seu acesso vence em ${daysRemaining} ${daysRemaining === 1 ? "dia" : "dias"}`,
    to,
  });

export const sendCourseSalesOpenedEmail = async ({
  courseSlug,
  courseTitle,
  idempotencyKey,
  to,
  userName,
}: {
  courseSlug: string;
  courseTitle: string;
  idempotencyKey: string;
  to: string;
  userName: string;
}): Promise<void> =>
  sendTransactionalEmail({
    idempotencyKey,
    react: CourseSalesOpenedEmail({
      actionUrl: `${getServerEnv().NEXT_PUBLIC_APP_URL}/comprar/${encodeURIComponent(courseSlug)}`,
      courseTitle,
      name: userName,
    }),
    subject: `Inscrições abertas: ${courseTitle}`,
    to,
  });

export const sendCertificateIssuedEmail = async ({
  certificateCode,
  courseTitle,
  idempotencyKey,
  to,
  userName,
}: {
  certificateCode: string;
  courseTitle: string;
  idempotencyKey?: string;
  to: string;
  userName: string;
}): Promise<void> =>
  sendTransactionalEmail({
    ...(idempotencyKey ? { idempotencyKey } : {}),
    react: CertificateIssuedEmail({
      actionUrl: `${getServerEnv().NEXT_PUBLIC_APP_URL}/app/certificados`,
      certificateCode,
      courseTitle,
      name: userName,
    }),
    subject: "Seu certificado PROTEA-R Hub foi emitido",
    to,
  });

export const sendSupportRequestEmail = async ({
  courseTitle,
  message,
  studentEmail,
  studentName,
  subject,
}: {
  courseTitle?: string;
  message: string;
  studentEmail: string;
  studentName: string;
  subject: string;
}): Promise<void> => {
  const env = getServerEnv();

  await sendTransactionalEmail({
    react: SupportRequestEmail({
      ...(courseTitle ? { courseTitle } : {}),
      message,
      studentEmail,
      studentName,
      subject,
    }),
    replyTo: studentEmail,
    subject: `Suporte: ${subject}`,
    to: env.SUPPORT_EMAIL ?? env.RESEND_FROM_EMAIL,
  });
};
