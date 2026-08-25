export interface SentryDeploymentEnvironment {
  DEPLOYMENT_GIT_SHA?: string | undefined;
  GITHUB_SHA?: string | undefined;
  NEXT_PUBLIC_SENTRY_RELEASE?: string | undefined;
  SENTRY_AUTH_TOKEN?: string | undefined;
  SENTRY_ORG?: string | undefined;
  SENTRY_PROJECT?: string | undefined;
  SENTRY_RELEASE?: string | undefined;
  VERCEL_GIT_COMMIT_SHA?: string | undefined;
  [key: string]: string | undefined;
}

export interface SentryBuildConfiguration {
  org?: string;
  project?: string;
  release?: string;
  uploadSourceMaps: boolean;
}

const FULL_GIT_SHA = /^[0-9a-f]{40}$/i;
const SENTRY_SLUG = /^[a-z0-9][a-z0-9_-]*$/;

const normalized = (value: string | undefined): string | undefined => {
  const result = value?.trim();
  return result ? result : undefined;
};

export const resolveSentryRelease = (
  env: SentryDeploymentEnvironment
): string | undefined => {
  const candidates = [
    env.SENTRY_RELEASE,
    env.NEXT_PUBLIC_SENTRY_RELEASE,
    env.VERCEL_GIT_COMMIT_SHA,
    env.DEPLOYMENT_GIT_SHA,
    env.GITHUB_SHA,
  ];
  return candidates
    .map(normalized)
    .find((candidate): candidate is string =>
      Boolean(candidate && FULL_GIT_SHA.test(candidate))
    );
};

export const resolveSentryBuildConfiguration = (
  env: SentryDeploymentEnvironment
): SentryBuildConfiguration => {
  const authToken = normalized(env.SENTRY_AUTH_TOKEN);
  const org = normalized(env.SENTRY_ORG);
  const project = normalized(env.SENTRY_PROJECT);
  const release = resolveSentryRelease(env);

  if (org && !SENTRY_SLUG.test(org)) {
    throw new Error("SENTRY_ORG must be a valid Sentry slug.");
  }
  if (project && !SENTRY_SLUG.test(project)) {
    throw new Error("SENTRY_PROJECT must be a valid Sentry slug.");
  }
  if (authToken && !org) {
    throw new Error(
      "SENTRY_ORG is required when SENTRY_AUTH_TOKEN is configured."
    );
  }
  if (authToken && !project) {
    throw new Error(
      "SENTRY_PROJECT is required when SENTRY_AUTH_TOKEN is configured."
    );
  }
  if (authToken && !release) {
    throw new Error(
      "A full deployment Git SHA is required when SENTRY_AUTH_TOKEN is configured."
    );
  }

  return {
    ...(org ? { org } : {}),
    ...(project ? { project } : {}),
    ...(release ? { release } : {}),
    uploadSourceMaps: Boolean(authToken),
  };
};

export const isFullSentryRelease = (value: string | undefined): boolean =>
  Boolean(value && FULL_GIT_SHA.test(value));
