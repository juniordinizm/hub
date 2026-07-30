import { sendPasswordResetEmail } from "@/features/email/server";
import { getAccountActivationDeliveryContext } from "@/lib/account-activation-delivery-context";
import { getServerEnv } from "@/lib/env";
import { getAccountActivationEmailIdempotencyKey } from "./account-activation-idempotency";

interface BetterAuthPasswordResetInput {
  url: string;
  user: {
    email: string;
    name: string;
  };
}

const ACCOUNT_ACTIVATION_EMAIL_DELIVERY_FAILED =
  "account_activation_email_delivery_failed";

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
  try {
    await sendPasswordResetEmail({
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
