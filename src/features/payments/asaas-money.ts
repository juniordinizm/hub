const PROVIDER_DECIMAL_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

export const parseAsaasDecimalToCents = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  const match = PROVIDER_DECIMAL_PATTERN.exec(String(value));
  if (!match) {
    return null;
  }

  const whole = BigInt(match[1] ?? "0");
  const fraction = (match[2] ?? "").padEnd(2, "0");
  const cents = whole * BigInt(100) + BigInt(fraction || "0");
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
};

export const parseSignedAsaasDecimalToCents = (
  value: unknown
): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const absolute = parseAsaasDecimalToCents(Math.abs(value));
  return absolute === null ? null : Math.sign(value) * absolute;
};
