const BUYER_EMAIL_MAX_LENGTH = 254;
const BUYER_EMAIL_LOCAL_PART_MAX_LENGTH = 64;
const BUYER_NAME_MAX_LENGTH = 120;
const BUYER_EMAIL_PATTERN =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const GMAIL_IDENTITY_DOMAINS = new Set(["gmail.com", "googlemail.com"]);
const PLUS_ADDRESSING_IDENTITY_DOMAINS = new Set([
  "fastmail.com",
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "mac.com",
  "me.com",
  "outlook.com",
  "proton.me",
  "protonmail.com",
  "yahoo.com",
  "zoho.com",
]);

export interface BuyerIdentity {
  email: string;
  name: string;
}

export const normalizeBuyerEmail = (email: string): string => {
  const trimmedEmail = email.trim().toLowerCase();
  const separatorIndex = trimmedEmail.lastIndexOf("@");
  if (separatorIndex < 0) {
    return trimmedEmail;
  }

  let localPart = trimmedEmail.slice(0, separatorIndex);
  let domain = trimmedEmail.slice(separatorIndex + 1);
  if (domain === "googlemail.com") {
    domain = "gmail.com";
  }
  if (PLUS_ADDRESSING_IDENTITY_DOMAINS.has(domain)) {
    localPart = localPart.split("+", 1)[0] ?? localPart;
  }
  if (GMAIL_IDENTITY_DOMAINS.has(domain)) {
    localPart = localPart.replaceAll(".", "");
  }

  return `${localPart}@${domain}`;
};

export const parseBuyerIdentity = (value: unknown): BuyerIdentity | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  if (!("email" in value && "name" in value)) {
    return null;
  }

  const { email, name } = value;
  if (typeof email !== "string" || typeof name !== "string") {
    return null;
  }

  const normalizedEmail = normalizeBuyerEmail(email);
  const normalizedName = name.trim();
  const emailLocalPart = normalizedEmail.split("@", 1)[0] ?? "";
  if (
    normalizedEmail.length > BUYER_EMAIL_MAX_LENGTH ||
    emailLocalPart.length > BUYER_EMAIL_LOCAL_PART_MAX_LENGTH ||
    !BUYER_EMAIL_PATTERN.test(normalizedEmail) ||
    !normalizedName ||
    Array.from(normalizedName).length > BUYER_NAME_MAX_LENGTH
  ) {
    return null;
  }

  return { email: normalizedEmail, name: normalizedName };
};
