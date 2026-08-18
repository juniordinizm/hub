import "server-only";
import { createHash } from "node:crypto";
import { isIsolatedE2eRuntime } from "@/lib/env";

const CERTIFICATE_EMAIL_DELIVERY_REGISTRY = Symbol.for(
  "protea-r-hub.e2e.certificate-email-deliveries.v2"
);
const SINK_UNAVAILABLE_MESSAGE = "Certificate email E2E sink is unavailable.";

export interface E2eCertificateEmailDelivery {
  idempotencyKey: string | null;
  recipientKey: string;
  topic: "email.certificate-issued";
}

interface RecordE2eCertificateEmailDeliveryInput {
  idempotencyKey?: string;
  recipient: string;
}

const assertSinkAvailable = (): void => {
  if (!isIsolatedE2eRuntime(process.env)) {
    throw new Error(SINK_UNAVAILABLE_MESSAGE);
  }
};

const getRegistry = (): E2eCertificateEmailDelivery[] => {
  const existingRegistry = Reflect.get(
    globalThis,
    CERTIFICATE_EMAIL_DELIVERY_REGISTRY
  );
  if (Array.isArray(existingRegistry)) {
    return existingRegistry as E2eCertificateEmailDelivery[];
  }

  const registry: E2eCertificateEmailDelivery[] = [];
  Reflect.set(globalThis, CERTIFICATE_EMAIL_DELIVERY_REGISTRY, registry);
  return registry;
};

export const recordE2eCertificateEmailDelivery = ({
  idempotencyKey,
  recipient,
}: RecordE2eCertificateEmailDeliveryInput): void => {
  assertSinkAvailable();
  getRegistry().push({
    idempotencyKey: idempotencyKey ?? null,
    recipientKey: `sha256:${createHash("sha256")
      .update(recipient.trim().toLowerCase())
      .digest("hex")}`,
    topic: "email.certificate-issued",
  });
};

export const getE2eCertificateEmailDeliveries =
  (): E2eCertificateEmailDelivery[] => {
    assertSinkAvailable();
    return getRegistry().map((delivery) => ({ ...delivery }));
  };

export const resetE2eCertificateEmailDeliveries = (): void => {
  assertSinkAvailable();
  getRegistry().length = 0;
};
