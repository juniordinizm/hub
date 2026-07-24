const toAllowedDevOrigin = (value: string): string | null => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue.startsWith("*.")) {
    return trimmedValue;
  }

  try {
    return new URL(trimmedValue).hostname;
  } catch {
    return trimmedValue;
  }
};

const addOrigins = (origins: Set<string>, value?: string): void => {
  for (const item of value?.split(",") ?? []) {
    const origin = toAllowedDevOrigin(item);

    if (origin && origin !== "localhost") {
      origins.add(origin);
    }
  }
};

export const getAllowedDevOrigins = (
  env: Record<string, string | undefined>
): string[] => {
  const origins = new Set<string>();

  addOrigins(origins, env.NEXT_ALLOWED_DEV_ORIGINS);
  addOrigins(origins, env.NEXT_PUBLIC_APP_URL);
  addOrigins(origins, env.BETTER_AUTH_URL);
  addOrigins(origins, env.BETTER_AUTH_TRUSTED_ORIGINS);
  addOrigins(origins, env.CERTIFICATE_PUBLIC_BASE_URL);

  return [...origins];
};
