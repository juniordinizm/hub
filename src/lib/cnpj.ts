const CNPJ_DIGIT_COUNT = 14;
const CNPJ_FORMAT_PATTERN = /^(?:\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$/;
const REPEATED_DIGITS_PATTERN = /^(\d)\1+$/;
const FIRST_CHECK_DIGIT_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const SECOND_CHECK_DIGIT_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

const getDigits = (value: string): string => value.replace(/\D/g, "");

const calculateCheckDigit = (value: string): string => {
  const weights =
    value.length === 12
      ? FIRST_CHECK_DIGIT_WEIGHTS
      : SECOND_CHECK_DIGIT_WEIGHTS;
  const sum = value
    .split("")
    .reduce(
      (total, digit, index) => total + Number(digit) * (weights[index] ?? 0),
      0
    );
  const remainder = sum % 11;
  return String(remainder < 2 ? 0 : 11 - remainder);
};

export const formatCnpj = (digits: string): string =>
  `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;

export const formatCnpjInput = (value: string): string => {
  const digits = getDigits(value).slice(0, CNPJ_DIGIT_COUNT);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 5) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }
  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  if (digits.length === 13) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  return formatCnpj(digits);
};

export const isValidCnpj = (value: string): boolean => {
  const trimmedValue = value.trim();
  if (!CNPJ_FORMAT_PATTERN.test(trimmedValue)) {
    return false;
  }

  const digits = getDigits(trimmedValue);
  if (
    digits.length !== CNPJ_DIGIT_COUNT ||
    REPEATED_DIGITS_PATTERN.test(digits)
  ) {
    return false;
  }

  const firstCheckDigit = calculateCheckDigit(digits.slice(0, 12));
  const secondCheckDigit = calculateCheckDigit(
    digits.slice(0, 12) + firstCheckDigit
  );
  return digits.slice(12) === firstCheckDigit + secondCheckDigit;
};

export const normalizeCnpj = (value: string): string | null => {
  if (!isValidCnpj(value)) {
    return null;
  }
  return formatCnpj(getDigits(value));
};
