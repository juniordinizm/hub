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

  const forwardedAddress =
    headers.get("x-forwarded-for")?.split(",")[0] ?? null;
  return validAddressOrUnknown(forwardedAddress || headers.get("x-real-ip"));
};
