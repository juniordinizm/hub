import "server-only";
import { getServerEnv } from "@/lib/env";
import { resolveAsaasCustomer } from "./asaas-customer-resolution";
import { createAsaasIdentityFingerprint } from "./buyer-identity";
import { createAsaasInvoiceIntent } from "./invoice-intent";
import { PostgresAsaasCustomerMappingRepository } from "./postgres-asaas-customer-mapping-repository";
import { PostgresInvoiceIntentStore } from "./postgres-invoice-intent-store";
import { getApplicationUrl, getAsaasProviderClient } from "./provider";
import { authorizePublicCheckoutIntent } from "./public-checkout";
import type { PublicPurchaseBody } from "./public-purchase-api";

export const createPublicCourseInvoicePurchase = async ({
  input,
  ipAddress,
}: {
  input: PublicPurchaseBody;
  ipAddress: string;
}) => {
  const environment = getServerEnv();
  const gateway = getAsaasProviderClient();
  const customerRepository = new PostgresAsaasCustomerMappingRepository();
  const fingerprint = createAsaasIdentityFingerprint({
    cpfCnpj: input.cpfCnpj,
    normalizedEmail: input.email,
    secret: environment.BETTER_AUTH_SECRET,
  });
  const store = new PostgresInvoiceIntentStore({
    authorize: async (courseId) =>
      await authorizePublicCheckoutIntent({
        courseId,
        ipAddress,
        secret: environment.BETTER_AUTH_SECRET,
      }),
    gateway,
  });
  return await createAsaasInvoiceIntent({
    ...(environment.ASAAS_PAYMENT_RETURN_ENABLED
      ? { callbackUrl: getApplicationUrl("/checkout/sucesso") }
      : {}),
    gateway,
    input,
    resolveCustomer: async () =>
      await resolveAsaasCustomer({
        cpfCnpj: input.cpfCnpj,
        fingerprint,
        gateway,
        name: input.name,
        normalizedEmail: input.email,
        repository: customerRepository,
      }),
    store,
  });
};
