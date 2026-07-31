import "server-only";
import { AsaasClient } from "@/features/payments/asaas-client";
import { getServerEnv } from "@/lib/env";

export const getAsaasProviderClient = (): AsaasClient => {
  const env = getServerEnv();

  if (!(env.ASAAS_API_KEY && env.ASAAS_API_BASE_URL && env.ASAAS_USER_AGENT)) {
    throw new Error("ConfiguraÃ§Ã£o Asaas incompleta.");
  }

  return new AsaasClient({
    accessToken: env.ASAAS_API_KEY,
    baseUrl: env.ASAAS_API_BASE_URL,
    userAgent: env.ASAAS_USER_AGENT,
  });
};

export const getApplicationUrl = (path: string): string =>
  new URL(path, getServerEnv().NEXT_PUBLIC_APP_URL).toString();
