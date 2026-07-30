import "server-only";
import { AbacatePayClient } from "@/features/payments/abacatepay-client";
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

export const getAbacatePayProviderClient = (): AbacatePayClient => {
  const env = getServerEnv();
  const apiKey = env.ABACATE_PAY_API_KEY ?? env.ABACATEPAY_API_KEY;

  if (!apiKey) {
    throw new Error("Configure ABACATE_PAY_API_KEY para usar o AbacatePay.");
  }

  return new AbacatePayClient({
    apiKey,
    baseUrl: env.ABACATEPAY_API_BASE_URL,
  });
};

export const getApplicationUrl = (path: string): string =>
  new URL(path, getServerEnv().NEXT_PUBLIC_APP_URL).toString();
