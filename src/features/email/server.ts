import "server-only";
import { render } from "@react-email/components";
import { Resend } from "resend";
import { getPool } from "@/db";
import { assertDevelopmentOrStagingEmailRecipientAllowed } from "@/features/email/development-recipient";
import { recordE2eCertificateEmailDelivery } from "@/features/email/e2e-delivery-sink";
import {
  beginEmailDeliveryAttempt,
  buildResendLifecycleTags,
  createEmailRequestFingerprint,
  type EmailDeliveryContext,
  markEmailAcceptanceUnknown,
  markEmailAccepted,
  markEmailIdempotencySatisfied,
  markEmailProviderRejected,
} from "@/features/email-delivery/server";
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

export interface EmailProviderAcceptance {
  acceptedAt: Date;
  messageId: string;
  provider: "resend";
}

export type HostedEmailDeliveryContext = Omit<
  EmailDeliveryContext,
  "templateAlias"
>;

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
  return;
};

type ResendEmailInput = Parameters<
  InstanceType<typeof Resend>["emails"]["send"]
>[0];
type ResendEmailResponse = Awaited<
  ReturnType<InstanceType<typeof Resend>["emails"]["send"]>
>;

const prepareLifecycleAttempt = async ({
  context,
  requestFingerprint,
}: {
  context: EmailDeliveryContext;
  requestFingerprint: string;
}) => {
  const client = await getPool().connect();
  let transactionOpen = false;
  try {
    await client.query("begin");
    transactionOpen = true;
    const attempt = await beginEmailDeliveryAttempt({
      client,
      context,
      requestFingerprint,
    });
    await client.query("commit");
    transactionOpen = false;
    return attempt;
  } catch (error) {
    if (transactionOpen) {
      await client.query("rollback");
    }
    throw error;
  } finally {
    client.release();
  }
};

const resolveLifecycleProviderResponse = async ({
  authSecret,
  context,
  emailMessageId,
  response,
}: {
  authSecret: string;
  context: EmailDeliveryContext;
  emailMessageId: string;
  response: ResendEmailResponse;
}): Promise<EmailProviderAcceptance | undefined> => {
  const { data, error } = response;
  const activationConflictSatisfied =
    error?.name === "invalid_idempotent_request" &&
    context.topic === "auth.account-activation" &&
    isAccountActivationEmailIdempotencyKey({
      authSecret,
      value: context.idempotencyKey,
    });
  if (activationConflictSatisfied) {
    const accepted = await markEmailIdempotencySatisfied({
      client: getPool(),
      emailMessageId,
    });
    if (!accepted) {
      throw new Error("resend_acceptance_unknown");
    }
    return;
  }
  if (
    error?.name === "invalid_idempotent_request" ||
    error?.name === "concurrent_idempotent_requests"
  ) {
    await markEmailAcceptanceUnknown({ client: getPool(), emailMessageId });
    throw new Error("resend_acceptance_unresolved");
  }
  if (!(data?.id || error)) {
    await markEmailAcceptanceUnknown({ client: getPool(), emailMessageId });
    throw new Error("resend_acceptance_unknown");
  }
  if (error || !data?.id) {
    await markEmailProviderRejected({ client: getPool(), emailMessageId });
    throw new Error("resend_provider_rejected");
  }
  const accepted = await markEmailAccepted({
    client: getPool(),
    emailMessageId,
    providerMessageId: data.id,
  });
  if (!accepted) {
    throw new Error("resend_acceptance_unknown");
  }
  return {
    acceptedAt: accepted.acceptedAt,
    messageId: data.id,
    provider: "resend",
  };
};

const sendHostedEmailWithLifecycle = async ({
  apiKey,
  authSecret,
  context,
  email,
}: {
  apiKey: string;
  authSecret: string;
  context: EmailDeliveryContext;
  email: ResendEmailInput;
}): Promise<EmailProviderAcceptance | undefined> => {
  const requestFingerprint = createEmailRequestFingerprint({
    authSecret,
    request: { email, idempotencyKey: context.idempotencyKey },
  });
  const attempt = await prepareLifecycleAttempt({
    context,
    requestFingerprint,
  });
  if (attempt.action === "accepted") {
    return {
      acceptedAt: attempt.acceptedAt,
      messageId: attempt.providerMessageId,
      provider: "resend",
    };
  }
  if (attempt.action === "satisfied") {
    return;
  }
  if (attempt.action === "unresolved") {
    throw new Error("resend_acceptance_unresolved");
  }
  let response: ResendEmailResponse;
  try {
    response = await new Resend(apiKey).emails.send(email, {
      idempotencyKey: context.idempotencyKey,
    });
  } catch {
    await markEmailAcceptanceUnknown({
      client: getPool(),
      emailMessageId: attempt.emailMessageId,
    });
    throw new Error("resend_acceptance_unknown");
  }
  return await resolveLifecycleProviderResponse({
    authSecret,
    context,
    emailMessageId: attempt.emailMessageId,
    response,
  });
};

export const sendHostedTemplateEmail = async ({
  deliveryContext,
  idempotencyKey,
  replyTo,
  subject,
  to,
  ...templateVariables
}: HostedEmailTemplateVariables & {
  deliveryContext?: HostedEmailDeliveryContext;
  idempotencyKey?: string;
  replyTo?: string;
  subject?: string;
  to: string;
}): Promise<EmailProviderAcceptance | undefined> => {
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
    ...(deliveryContext
      ? {
          tags: buildResendLifecycleTags({
            ...deliveryContext,
            templateAlias: alias,
          }),
        }
      : {}),
    to,
  };
  const resolvedIdempotencyKey =
    idempotencyKey ?? deliveryContext?.idempotencyKey;
  if (deliveryContext) {
    return await sendHostedEmailWithLifecycle({
      apiKey: env.RESEND_API_KEY,
      authSecret: env.BETTER_AUTH_SECRET,
      context: {
        ...deliveryContext,
        idempotencyKey:
          resolvedIdempotencyKey ?? deliveryContext.idempotencyKey,
        templateAlias: alias,
      },
      email,
    });
  }
  const { error } = await new Resend(env.RESEND_API_KEY).emails.send(
    email,
    ...(resolvedIdempotencyKey
      ? [{ idempotencyKey: resolvedIdempotencyKey }]
      : [])
  );

  handleEmailProviderError({
    authSecret: env.BETTER_AUTH_SECRET,
    error,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  });
  return;
};

export const sendPasswordResetEmail = async ({
  deliveryContext,
  idempotencyKey,
  resetUrl,
  to,
  userName,
}: {
  idempotencyKey?: string;
  deliveryContext?: HostedEmailDeliveryContext;
  resetUrl: string;
  to: string;
  userName: string;
}): Promise<EmailProviderAcceptance | undefined> =>
  sendHostedTemplateEmail({
    ACTION_URL: resetUrl,
    ...(idempotencyKey ? { idempotencyKey } : {}),
    ...(deliveryContext ? { deliveryContext } : {}),
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
  deliveryContext,
}: {
  courseId?: string;
  courseTitle: string;
  deliveryContext?: HostedEmailDeliveryContext;
  idempotencyKey?: string;
  to: string;
  userName: string;
}): Promise<EmailProviderAcceptance | undefined> => {
  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;

  return await sendHostedTemplateEmail({
    ACTION_URL: `${appUrl}${courseId ? `/app/cursos/${courseId}` : "/app"}`,
    COURSE_TITLE: courseTitle,
    ...(deliveryContext ? { deliveryContext } : {}),
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
  deliveryContext,
}: {
  courseId: string;
  courseTitle: string;
  daysRemaining: number;
  deliveryContext?: HostedEmailDeliveryContext;
  idempotencyKey?: string;
  to: string;
  userName: string;
}): Promise<EmailProviderAcceptance | undefined> => {
  const formattedDaysRemaining =
    daysRemaining === 1 ? "1 dia" : `${daysRemaining} dias`;

  return await sendHostedTemplateEmail({
    ACTION_URL: `${getServerEnv().NEXT_PUBLIC_APP_URL}/app/cursos/${courseId}`,
    COURSE_TITLE: courseTitle,
    DAYS_REMAINING: formattedDaysRemaining,
    ...(deliveryContext ? { deliveryContext } : {}),
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
  deliveryContext,
}: {
  courseSlug: string;
  courseTitle: string;
  deliveryContext?: HostedEmailDeliveryContext;
  idempotencyKey: string;
  to: string;
  userName: string;
}): Promise<EmailProviderAcceptance | undefined> =>
  sendHostedTemplateEmail({
    ACTION_URL: `${getServerEnv().NEXT_PUBLIC_APP_URL}/comprar/${encodeURIComponent(courseSlug)}`,
    COURSE_TITLE: courseTitle,
    ...(deliveryContext ? { deliveryContext } : {}),
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
  deliveryContext,
}: {
  certificateCode: string;
  courseTitle: string;
  deliveryContext?: HostedEmailDeliveryContext;
  idempotencyKey?: string;
  to: string;
  userName: string;
}): Promise<EmailProviderAcceptance | undefined> => {
  if (isIsolatedE2eRuntime(process.env)) {
    recordE2eCertificateEmailDelivery({
      ...(idempotencyKey ? { idempotencyKey } : {}),
      recipient: to,
    });
    return;
  }

  return await sendHostedTemplateEmail({
    ACTION_URL: new URL(
      `/certificados/${encodeURIComponent(certificateCode)}`,
      getServerEnv().CERTIFICATE_PUBLIC_BASE_URL
    ).toString(),
    CERTIFICATE_CODE: certificateCode,
    COURSE_TITLE: courseTitle,
    ...(deliveryContext ? { deliveryContext } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
    name: "certificate-issued",
    subject: "Seu certificado PROTEA-R Hub foi emitido",
    to,
    USER_NAME: userName,
  });
};

export const sendSupportRequestEmail = async ({
  courseTitle,
  idempotencyKey,
  message,
  studentEmail,
  studentName,
  subject,
  deliveryContext,
}: {
  courseTitle?: string;
  deliveryContext?: HostedEmailDeliveryContext;
  idempotencyKey?: string;
  message: string;
  studentEmail: string;
  studentName: string;
  subject: string;
}): Promise<EmailProviderAcceptance | undefined> => {
  const env = getServerEnv();

  return await sendHostedTemplateEmail({
    COURSE_TITLE: courseTitle ?? "Não informado",
    ...(deliveryContext ? { deliveryContext } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
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
