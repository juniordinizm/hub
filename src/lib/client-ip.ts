import { isIP } from "node:net";

export type ClientIpSource = "cloudflare" | "x-forwarded-for";

const validAddressOrUnknown = (value: string | null): string => {
  const address = value?.trim() ?? "";
  return isIP(address) > 0 ? address : "unknown";
};

export const getClientIpAddress = (
  headers: Headers,
  source: ClientIpSource
): string => {
  if (source === "cloudflare") {
    return validAddressOrUnknown(headers.get("cf-connecting-ip"));
  }

  // The client controls the leftmost x-forwarded-for entries; the trusted
  // reverse proxy appends the observed peer address last.
  const forwardedEntries = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const forwardedAddress = forwardedEntries?.at(-1) ?? null;
  return validAddressOrUnknown(forwardedAddress || headers.get("x-real-ip"));
};
