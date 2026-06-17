import "server-only";
import { Resend } from "resend";
import {
  AccessExpiryWarningEmail,
  AccessReleasedEmail,
  CertificateIssuedEmail,
  InviteEmail,
  PasswordResetEmail,
} from "@/features/email/templates";
import { getServerEnv } from "@/lib/env";

interface SendEmailInput {
  react: React.ReactNode;
  subject: string;
  to: string;
}

let resendClient: Resend | null = null;

const getResend = (): Resend | null => {
  const env = getServerEnv();

  if (!env.RESEND_API_KEY) {
    return null;
  }

  resendClient ??= new Resend(env.RESEND_API_KEY);
  return resendClient;
};

export const sendTransactionalEmail = async ({
  react,
  subject,
  to,
}: SendEmailInput): Promise<void> => {
  const resend = getResend();

  if (!resend) {
    return;
  }

  const env = getServerEnv();
  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    react,
    subject,
    to,
  });

  if (error) {
    throw new Error(`Falha ao enviar e-mail: ${error.message}`);
  }
};

export const sendInviteEmail = async ({
  resetUrl,
  to,
  userName,
}: {
  resetUrl: string;
  to: string;
  userName: string;
}): Promise<void> =>
  sendTransactionalEmail({
    react: InviteEmail({ actionUrl: resetUrl, name: userName }),
    subject: "Seu acesso ao PROTEA-R Hub",
    to,
  });

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
