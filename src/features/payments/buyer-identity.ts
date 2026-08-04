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
const CPF_CNPJ_LENGTH_PATTERN = /^\d{11}(?:\d{3})?$/;
const REPEATED_DIGITS_PATTERN = /^(\d)\1+$/;

export interface BuyerIdentity {
  email: string;
  name: string;
}

export interface PurchaseBuyerIdentity extends BuyerIdentity {
  cpfCnpj: string;
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

const hasValidCheckDigits = (
  digits: string,
  initialLength: number
): boolean => {
  let current = digits.slice(0, initialLength);
  for (let index = initialLength; index < digits.length; index += 1) {
    let sum = 0;
    if (digits.length === 11) {
      const weightStart = current.length + 1;
      for (let position = 0; position < current.length; position += 1) {
        sum += Number(current[position]) * (weightStart - position);
      }
      const remainder = (sum * 10) % 11;
      current += String(remainder === 10 ? 0 : remainder);
    } else {
      let weight = current.length - 7;
      for (const digit of current) {
        sum += Number(digit) * weight;
        weight -= 1;
        if (weight === 1) {
          weight = 9;
        }
      }
      const remainder = sum % 11;
      current += String(remainder < 2 ? 0 : 11 - remainder);
    }
  }
  return current === digits;
};

const isValidCpfCnpj = (digits: string): boolean => {
  if (
    !CPF_CNPJ_LENGTH_PATTERN.test(digits) ||
    REPEATED_DIGITS_PATTERN.test(digits)
  ) {
    return false;
  }
  return hasValidCheckDigits(digits, digits.length === 11 ? 9 : 12);
};

export const parsePurchaseBuyerIdentity = (
  value: unknown
): PurchaseBuyerIdentity | null => {
  const identity = parseBuyerIdentity(value);
  if (!(identity && typeof value === "object" && value !== null)) {
    return null;
  }
  const cpfCnpj = "cpfCnpj" in value ? value.cpfCnpj : null;
  if (typeof cpfCnpj !== "string") {
    return null;
  }
  const digits = cpfCnpj.replace(/\D/g, "");
  if (!isValidCpfCnpj(digits)) {
    return null;
  }
  return { ...identity, cpfCnpj: digits };
};

export const createAsaasIdentityFingerprint = ({
  cpfCnpj,
  normalizedEmail,
  secret,
}: {
  cpfCnpj: string;
  normalizedEmail: string;
  secret: string;
}): string =>
  createHmac("sha256", secret)
    .update("asaas-customer:v1:")
    .update(cpfCnpj)
    .update(":")
    .update(normalizedEmail)
    .digest("hex");

import { createHmac } from "node:crypto";
