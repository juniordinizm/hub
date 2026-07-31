const ALLOWED_CHECKOUT_HOSTNAMES = new Set([
  "asaas.com",
  "sandbox.asaas.com",
  "www.asaas.com",
]);
const AUTHORITY_END_PATTERN = /[/?#]/;

const getRawAuthority = (value: string): string | null => {
  const separatorIndex = value.indexOf("://");
  if (separatorIndex < 0) {
    return null;
  }

  const authorityStart = separatorIndex + 3;
  const remainder = value.slice(authorityStart);
  const authorityEnd = remainder.search(AUTHORITY_END_PATTERN);
  return authorityEnd < 0 ? remainder : remainder.slice(0, authorityEnd);
};

export const isAllowedCheckoutUrl = (value: string): boolean => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  const rawAuthority = getRawAuthority(value);
  const isExactE2eCheckoutOrigin =
    process.env.NEXT_PUBLIC_E2E_TEST_MODE === "true" &&
    url.protocol === "http:" &&
    url.hostname === "127.0.0.1" &&
    url.port === "4570" &&
    rawAuthority === "127.0.0.1:4570";

  return (
    url.username === "" &&
    url.password === "" &&
    (isExactE2eCheckoutOrigin ||
      (url.protocol === "https:" &&
        url.port === "" &&
        rawAuthority?.toLowerCase() === url.hostname &&
        ALLOWED_CHECKOUT_HOSTNAMES.has(url.hostname)))
  );
};

export const redirectToCheckout = (url: string): void => {
  if (!isAllowedCheckoutUrl(url)) {
    throw new Error("Checkout redirect URL is not allowed.");
  }

  window.location.assign(url);
};
