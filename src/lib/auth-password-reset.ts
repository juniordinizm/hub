import { after } from "next/server";
import { sendPasswordResetEmail } from "@/features/email/server";
import { getAccountActivationDeliveryContext } from "@/lib/account-activation-delivery-context";
import { getServerEnv } from "@/lib/env";
import { getAccountActivationEmailIdempotencyKey } from "./account-activation-idempotency";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
  logOperationalEvent,
} from "./observability";

interface BetterAuthPasswordResetInput {
  url: string;
  user: {
    email: string;
    name: string;
  };
}

const ACCOUNT_ACTIVATION_EMAIL_DELIVERY_FAILED =
  "account_activation_email_delivery_failed";
const PASSWORD_RESET_EMAIL_DELIVERY_FAILED =
  "password_reset_email_delivery_failed";

const sendPublicPasswordResetEmail = async ({
  deliveryCorrelationId,
  logCorrelationId,
  resetUrl,
  to,
  userName,
}: {
  deliveryCorrelationId: string;
  logCorrelationId: string;
  resetUrl: string;
  to: string;
  userName: string;
}): Promise<void> => {
  const idempotencyKey = `auth.password-reset/${deliveryCorrelationId}/v1`;
  try {
    await sendPasswordResetEmail({
      deliveryContext: {
        correlationId: deliveryCorrelationId,
        idempotencyKey,
        topic: "auth.password-reset",
      },
      idempotencyKey,
      resetUrl,
      to,
      userName,
    });
  } catch {
    logOperationalEvent({
      correlationId: logCorrelationId,
      errorCode: PASSWORD_RESET_EMAIL_DELIVERY_FAILED,
      operation: "auth.password_reset",
      outcome: "failure",
      provider: "resend",
    });
  }
};

export const sendBetterAuthPasswordResetEmail = async (
  { url, user }: BetterAuthPasswordResetInput,
  request?: Request
): Promise<void> => {
  const idempotencyKey = getAccountActivationEmailIdempotencyKey({
    authSecret: getServerEnv().BETTER_AUTH_SECRET,
    ...(request ? { request } : {}),
  });
  const deliveryContext = idempotencyKey
    ? getAccountActivationDeliveryContext(idempotencyKey)
    : undefined;

  if (request && !deliveryContext) {
    const logCorrelationId = createCorrelationId(
      request.headers.get(CORRELATION_ID_HEADER)
    );
    const deliveryCorrelationId = createCorrelationId(null);
    after(async () => {
      await sendPublicPasswordResetEmail({
        deliveryCorrelationId,
        logCorrelationId,
        resetUrl: url,
        to: user.email,
        userName: user.name,
      });
    });
    return;
  }

  try {
    await sendPasswordResetEmail({
      ...(deliveryContext?.emailDeliveryContext
        ? { deliveryContext: deliveryContext.emailDeliveryContext }
        : {}),
      ...(deliveryContext && idempotencyKey ? { idempotencyKey } : {}),
      resetUrl: url,
      to: user.email,
      userName: user.name,
    });
    deliveryContext?.recordDelivered();
  } catch (error) {
    if (deliveryContext) {
      deliveryContext.recordFailed();
      throw new Error(ACCOUNT_ACTIVATION_EMAIL_DELIVERY_FAILED);
    }
    throw error;
  }
};
