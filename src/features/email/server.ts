import "server-only";
import { Resend } from "resend";
import {
  AccessExpiryWarningEmail,
  AccessReleasedEmail,
  CertificateIssuedEmail,
  PasswordResetEmail,
  SupportRequestEmail,
} from "@/features/email/templates";
import { getServerEnv } from "@/lib/env";

interface SendEmailInput {
  react: React.ReactNode;
  replyTo?: string;
  subject: string;
  to: string;
}

export const sendTransactionalEmail = async ({
  react,
  replyTo,
  subject,
  to,
}: SendEmailInput): Promise<void> => {
  const env = getServerEnv();

  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is required to send transactional email.");
  }

  const { error } = await new Resend(env.RESEND_API_KEY).emails.send({
    from: env.RESEND_FROM_EMAIL,
    react,
    ...(replyTo ? { replyTo } : {}),
    subject,
    to,
  });

  if (error) {
    throw new Error(error.message);
  }
};

export const sendPasswordResetEmail = async ({
  resetUrl,
  to,
  userName,
}: {
  resetUrl: string;
  to: string;
  userName: string;
}): Promise<void> =>
  sendTransactionalEmail({
    react: PasswordResetEmail({ actionUrl: resetUrl, name: userName }),
    subject: "Criar ou redefinir senha do PROTEA-R Hub",
    to,
  });

export const sendAccessReleasedEmail = async ({
  courseId,
  courseTitle,
  to,
  userName,
}: {
  courseId?: string;
  courseTitle: string;
  to: string;
  userName: string;
}): Promise<void> =>
  sendTransactionalEmail({
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
  to,
  userName,
}: {
  courseId: string;
  courseTitle: string;
  daysRemaining: number;
  to: string;
  userName: string;
}): Promise<void> =>
  sendTransactionalEmail({
    react: AccessExpiryWarningEmail({
      actionUrl: `${getServerEnv().NEXT_PUBLIC_APP_URL}/app/cursos/${courseId}`,
      courseTitle,
      daysRemaining,
      name: userName,
    }),
    subject: `Seu acesso vence em ${daysRemaining} ${daysRemaining === 1 ? "dia" : "dias"}`,
    to,
  });

export const sendCertificateIssuedEmail = async ({
  certificateCode,
  courseTitle,
  to,
  userName,
}: {
  certificateCode: string;
  courseTitle: string;
  to: string;
  userName: string;
}): Promise<void> =>
  sendTransactionalEmail({
    react: CertificateIssuedEmail({
      actionUrl: `${getServerEnv().NEXT_PUBLIC_APP_URL}/certificados/${certificateCode}`,
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
