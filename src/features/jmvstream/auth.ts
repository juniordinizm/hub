import "server-only";
import {
  authenticateJmvstreamApi,
  createJmvstreamClient,
  isJmvstreamJwtUsable,
} from "@/features/jmvstream/client";
import { getServerEnv } from "@/lib/env";

let cachedApiToken: string | null = null;

const getJmvstreamApiToken = async (): Promise<string> => {
  const env = getServerEnv();
  const configuredToken = env.JMVSTREAM_API_TOKEN;

  if (configuredToken && isJmvstreamJwtUsable(configuredToken)) {
    return configuredToken;
  }

  if (cachedApiToken && isJmvstreamJwtUsable(cachedApiToken)) {
    return cachedApiToken;
  }

  if (env.JMVSTREAM_AUTH_RESOURCE) {
    const refreshedToken = await authenticateJmvstreamApi({
      apiBaseUrl: env.JMVSTREAM_API_BASE_URL,
      resource: env.JMVSTREAM_AUTH_RESOURCE,
    });
    cachedApiToken = refreshedToken;
    return refreshedToken;
  }

  if (env.JMVSTREAM_API_TOKEN) {
    throw new Error(
      "O token JMVStream configurado expirou. Configure JMVSTREAM_AUTH_RESOURCE para renovacao automatica."
    );
  }

  throw new Error(
    "Configure JMVSTREAM_AUTH_RESOURCE ou um token JMVStream valido para usar uploads no admin."
  );
};

export const getConfiguredJmvstreamClient = async () => {
  const env = getServerEnv();

  if (!env.JMVSTREAM_PLAN_ID) {
    throw new Error("Configure JMVSTREAM_PLAN_ID para usar a JMVStream.");
  }

  return createJmvstreamClient({
    apiBaseUrl: env.JMVSTREAM_API_BASE_URL,
    apiToken: await getJmvstreamApiToken(),
    planId: env.JMVSTREAM_PLAN_ID,
  });
};
