export const buildContentSecurityPolicy = ({
  additionalConnectOrigins,
  isProduction,
}: {
  additionalConnectOrigins: readonly string[];
  isProduction: boolean;
}): string => {
  const connectSources = [
    "'self'",
    "https:",
    "wss:",
    ...new Set(additionalConnectOrigins),
  ].join(" ");

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self' data:",
    `connect-src ${connectSources}`,
    "frame-src https:",
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
};
