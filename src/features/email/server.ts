import "server-only";
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

export const sendTransactionalEmail = (_input: SendEmailInput): Promise<void> =>
  Promise.resolve();

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
    subject: "Redefinir senha do PROTEA-R Hub",
    to,
  });

export const sendAccessReleasedEmail = async ({
  courseTitle,
  to,
  userName,
}: {
  courseTitle: string;
  to: string;
  userName: string;
}): Promise<void> =>
  sendTransactionalEmail({
    react: AccessReleasedEmail({
      actionUrl: `${getServerEnv().NEXT_PUBLIC_APP_URL}/app`,
      courseTitle,
      name: userName,
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
