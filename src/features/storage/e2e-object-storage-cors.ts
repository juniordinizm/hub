const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
const ALLOWED_REQUEST_HEADERS = new Set(["content-type"]);

export const getE2eObjectStorageCorsHeaders = ({
  origin,
  requestedHeaders,
}: {
  origin?: string;
  requestedHeaders?: string;
}): Record<string, string> => {
  if (!origin) {
    return {};
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return {};
  }
  if (
    originUrl.protocol !== "http:" ||
    !LOOPBACK_HOSTS.has(originUrl.hostname) ||
    originUrl.origin !== origin
  ) {
    return {};
  }

  const allowedHeaders = (requestedHeaders ?? "")
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .filter((header) => ALLOWED_REQUEST_HEADERS.has(header))
    .join(", ");

  return {
    ...(allowedHeaders
      ? { "access-control-allow-headers": allowedHeaders }
      : {}),
    "access-control-allow-methods": "GET, HEAD, PUT, POST, OPTIONS",
    "access-control-allow-origin": origin,
    "access-control-expose-headers": "etag",
    vary: "Origin, Access-Control-Request-Headers",
  };
};
