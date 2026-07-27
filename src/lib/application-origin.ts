export interface CanonicalApplicationEnvironment {
  BETTER_AUTH_URL?: string | undefined;
  CERTIFICATE_PUBLIC_BASE_URL?: string | undefined;
  NEXT_PUBLIC_APP_URL?: string | undefined;
  VERCEL_BRANCH_URL?: string | undefined;
  VERCEL_ENV?: string | undefined;
  VERCEL_URL?: string | undefined;
}

const getTrimmedValue = (value: string | undefined): string | undefined => {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
};

const getVercelPreviewOrigin = (
  environment: CanonicalApplicationEnvironment
): string | undefined => {
  if (environment.VERCEL_ENV !== "preview") {
    return;
  }

  const deploymentHostname =
    getTrimmedValue(environment.VERCEL_BRANCH_URL) ??
    getTrimmedValue(environment.VERCEL_URL);
  if (!deploymentHostname) {
    return;
  }

  return new URL(`https://${deploymentHostname}`).origin;
};

export const resolveCanonicalApplicationEnvironment = <
  Environment extends CanonicalApplicationEnvironment,
>(
  environment: Environment
): Environment &
  Required<
    Pick<
      CanonicalApplicationEnvironment,
      "BETTER_AUTH_URL" | "CERTIFICATE_PUBLIC_BASE_URL" | "NEXT_PUBLIC_APP_URL"
    >
  > => {
  const previewOrigin = getVercelPreviewOrigin(environment);

  return {
    ...environment,
    BETTER_AUTH_URL:
      getTrimmedValue(environment.BETTER_AUTH_URL) ?? previewOrigin,
    CERTIFICATE_PUBLIC_BASE_URL:
      getTrimmedValue(environment.CERTIFICATE_PUBLIC_BASE_URL) ?? previewOrigin,
    NEXT_PUBLIC_APP_URL:
      getTrimmedValue(environment.NEXT_PUBLIC_APP_URL) ?? previewOrigin,
  };
};
