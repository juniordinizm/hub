const SSL_MODES_WITH_LEGACY_ALIAS_WARNING = new Set([
  "prefer",
  "require",
  "verify-ca",
]);

export const withVerifiedSslMode = (connectionString: string): string => {
  if (!connectionString) {
    return connectionString;
  }

  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get("sslmode");

    if (!(sslMode && !SSL_MODES_WITH_LEGACY_ALIAS_WARNING.has(sslMode))) {
      url.searchParams.set("sslmode", "verify-full");
    }

    return url.toString();
  } catch {
    const separator = connectionString.includes("?") ? "&" : "?";
    return `${connectionString}${separator}sslmode=verify-full`;
  }
};
