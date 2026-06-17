const toOrigin = (value: string): string | null => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const isString = (value: string | null): value is string => value !== null;

export const parseTrustedOrigins = ({
  defaults,
  extraOrigins,
}: {
  defaults: string[];
  extraOrigins?: string | undefined;
}): string[] => {
  const origins = new Set(defaults.map(toOrigin).filter(isString));
  const extraValues = extraOrigins?.split(",") ?? [];

  for (const value of extraValues) {
    const origin = toOrigin(value.trim());

    if (origin) {
      origins.add(origin);
    }
  }

  return [...origins];
};
