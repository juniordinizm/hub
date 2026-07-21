import "server-only";
import { AbacatePayClient } from "@/features/payments/abacatepay-client";
import { getServerEnv } from "@/lib/env";

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
