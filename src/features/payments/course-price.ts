const COURSE_PRICE_INVALID_MESSAGE = "Preco do curso invalido.";
const MINIMUM_PAID_COURSE_PRICE_IN_CENTS = 1000;
const MAXIMUM_COURSE_PRICE_IN_CENTS = 2_147_483_647;
const BRL_PRICE_RE = /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/;
const DOT_DECIMAL_PRICE_RE = /^\d+\.\d{1,2}$/;
const THOUSANDS_PRICE_RE = /^\d{1,3}(?:\.\d{3})+$/;
const BRL_PREFIX_RE = /^R\$\s*/;

const invalidCoursePrice = (): never => {
  throw new Error(COURSE_PRICE_INVALID_MESSAGE);
};

export const parseCoursePriceToCents = (value: string): number => {
  const normalized = value.trim().replace(BRL_PREFIX_RE, "");

  if (
    !(
      normalized &&
      (BRL_PRICE_RE.test(normalized) || DOT_DECIMAL_PRICE_RE.test(normalized))
    )
  ) {
    return invalidCoursePrice();
  }

  const usesCommaDecimal = normalized.includes(",");
  const usesDotDecimal =
    !usesCommaDecimal && DOT_DECIMAL_PRICE_RE.test(normalized);
  let priceParts = [normalized];
  if (usesCommaDecimal) {
    priceParts = normalized.split(",");
  } else if (usesDotDecimal) {
    priceParts = normalized.split(".");
  }
  const [rawReais, rawCents = ""] = priceParts;
  const reais =
    usesCommaDecimal || THOUSANDS_PRICE_RE.test(normalized)
      ? rawReais?.replace(/\./g, "")
      : rawReais;

  if (!reais) {
    return invalidCoursePrice();
  }

  const cents = rawCents.padEnd(2, "0");
  const amountInCents = BigInt(reais) * BigInt(100) + BigInt(cents || "0");

  if (
    amountInCents > BigInt(MAXIMUM_COURSE_PRICE_IN_CENTS) ||
    (amountInCents > BigInt(0) &&
      amountInCents < BigInt(MINIMUM_PAID_COURSE_PRICE_IN_CENTS))
  ) {
    return invalidCoursePrice();
  }

  return Number(amountInCents);
};
