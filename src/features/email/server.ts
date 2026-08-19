import "server-only";
import { render } from "@react-email/components";
import { Resend } from "resend";
import { assertDevelopmentOrStagingEmailRecipientAllowed } from "@/features/email/development-recipient";
import { recordE2eCertificateEmailDelivery } from "@/features/email/e2e-delivery-sink";
import { isAccountActivationEmailIdempotencyKey } from "@/lib/account-activation-idempotency";
import { getServerEnv, isIsolatedE2eRuntime } from "@/lib/env";
import { resolveRuntimeEnvironment } from "@/lib/runtime-environment";
import type { HostedEmailTemplateVariables } from "./templates-contract";
import {
  resolveHostedTemplateAlias,
  validateHostedTemplateVariables,
} from "./templates-contract";

interface SendEmailInput {
  idempotencyKey?: string;
  react: React.ReactNode;
  replyTo?: string;
  subject: string;
  to: string;
}

interface EmailProviderError {
  message: string;
  name?: string;
}

const resolveAndAssertEmailRuntimeEnvironment = ({
  env,
  recipient,
}: {
  env: ReturnType<typeof getServerEnv>;
  recipient: string;
}): ReturnType<typeof resolveRuntimeEnvironment> => {
  const runtimeEnvironment = resolveRuntimeEnvironment(process.env);
  const recipientEnvironment =
    runtimeEnvironment === "staging" ? "staging" : env.NODE_ENV;
  const recipientAllowlist =
    runtimeEnvironment === "staging"
      ? env.STAGING_EMAIL_RECIPIENT_ALLOWLIST
      : env.DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST;

  assertDevelopmentOrStagingEmailRecipientAllowed({
    allowlist: recipientAllowlist,
    environment: recipientEnvironment,
    recipient,
  });

  return runtimeEnvironment;
};

const handleEmailProviderError = ({
  authSecret,
  error,
  idempotencyKey,
}: {
  authSecret: string;
  error: EmailProviderError | null;
  idempotencyKey?: string;
}): void => {
  const activationEmailAlreadyAccepted =
    error?.name === "invalid_idempotent_request" &&
    Boolean(
      idempotencyKey &&
        isAccountActivationEmailIdempotencyKey({
          authSecret,
          value: idempotencyKey,
        })
    );

  if (error && !activationEmailAlreadyAccepted) {
    throw new Error(error.message);
  }
};

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

  resolveAndAssertEmailRuntimeEnvironment({ env, recipient: to });

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

  handleEmailProviderError({
    authSecret: env.BETTER_AUTH_SECRET,
    error,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  });
};

export const sendHostedTemplateEmail = async ({
  idempotencyKey,
  replyTo,
  subject,
  to,
  ...templateVariables
}: HostedEmailTemplateVariables & {
  idempotencyKey?: string;
  replyTo?: string;
  subject?: string;
  to: string;
}): Promise<void> => {
  const env = getServerEnv();

  validateHostedTemplateVariables(templateVariables);

  if (env.E2E_TEST_MODE) {
    return;
  }

  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is required to send transactional email.");
  }

  const runtimeEnvironment = resolveAndAssertEmailRuntimeEnvironment({
    env,
    recipient: to,
  });
  const { name, ...variables } = templateVariables;
  const alias = resolveHostedTemplateAlias({
    name,
    runtimeEnvironment,
  });

  const resolvedReplyTo = replyTo ?? env.SUPPORT_EMAIL;
  const email = {
    from: env.RESEND_FROM_EMAIL,
    ...(resolvedReplyTo ? { replyTo: resolvedReplyTo } : {}),
    ...(subject === undefined ? {} : { subject }),
    template: {
      id: alias,
      variables,
    },
    to,
  };
  const { error } = await new Resend(env.RESEND_API_KEY).emails.send(
    email,
    ...(idempotencyKey ? [{ idempotencyKey }] : [])
  );

  handleEmailProviderError({
    authSecret: env.BETTER_AUTH_SECRET,
    error,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  });
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
  sendHostedTemplateEmail({
    ACTION_URL: resetUrl,
    ...(idempotencyKey ? { idempotencyKey } : {}),
    name: "auth-password-reset",
    subject: "Criar ou redefinir senha do PROTEA-R Hub",
    to,
    USER_NAME: userName,
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
}): Promise<void> => {
  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;

  await sendHostedTemplateEmail({
    ACTION_URL: `${appUrl}${courseId ? `/app/cursos/${courseId}` : "/app"}`,
    COURSE_TITLE: courseTitle,
    ...(idempotencyKey ? { idempotencyKey } : {}),
    name: "access-released",
    PASSWORD_RESET_URL: `${appUrl}/recuperar-senha`,
    subject: "Acesso liberado no PROTEA-R Hub",
    to,
    USER_NAME: userName,
  });
};

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
}): Promise<void> => {
  const formattedDaysRemaining =
    daysRemaining === 1 ? "1 dia" : `${daysRemaining} dias`;

  await sendHostedTemplateEmail({
    ACTION_URL: `${getServerEnv().NEXT_PUBLIC_APP_URL}/app/cursos/${courseId}`,
    COURSE_TITLE: courseTitle,
    DAYS_REMAINING: formattedDaysRemaining,
    ...(idempotencyKey ? { idempotencyKey } : {}),
    name: "access-expiry-warning",
    subject: `Seu acesso vence em ${formattedDaysRemaining}`,
    to,
    USER_NAME: userName,
  });
};

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
  sendHostedTemplateEmail({
    ACTION_URL: `${getServerEnv().NEXT_PUBLIC_APP_URL}/comprar/${encodeURIComponent(courseSlug)}`,
    COURSE_TITLE: courseTitle,
    USER_NAME: userName,
    idempotencyKey,
    name: "course-sales-opened",
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
}): Promise<void> => {
  if (isIsolatedE2eRuntime(process.env)) {
    recordE2eCertificateEmailDelivery({
      ...(idempotencyKey ? { idempotencyKey } : {}),
      recipient: to,
    });
    return;
  }

  await sendHostedTemplateEmail({
    ACTION_URL: new URL(
      `/certificados/${encodeURIComponent(certificateCode)}`,
      getServerEnv().CERTIFICATE_PUBLIC_BASE_URL
    ).toString(),
    CERTIFICATE_CODE: certificateCode,
    COURSE_TITLE: courseTitle,
    ...(idempotencyKey ? { idempotencyKey } : {}),
    name: "certificate-issued",
    subject: "Seu certificado PROTEA-R Hub foi emitido",
    to,
    USER_NAME: userName,
  });
};

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

  await sendHostedTemplateEmail({
    COURSE_TITLE: courseTitle ?? "Não informado",
    MESSAGE: message,
    name: "support-request",
    replyTo: studentEmail,
    subject: `Suporte: ${subject}`,
    STUDENT_EMAIL: studentEmail,
    STUDENT_NAME: studentName,
    SUPPORT_SUBJECT: subject,
    to: env.SUPPORT_EMAIL ?? env.RESEND_FROM_EMAIL,
  });
};
