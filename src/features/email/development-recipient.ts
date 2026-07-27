const normalizeEmailAddress = (value: string): string =>
  value.trim().toLowerCase();

export const assertDevelopmentEmailRecipientAllowed = ({
  allowlist,
  environment,
  recipient,
}: {
  allowlist: string | undefined;
  environment: string;
  recipient: string;
}): void => {
  if (environment !== "development") {
    return;
  }

  const allowedRecipients = new Set(
    (allowlist ?? "").split(",").map(normalizeEmailAddress).filter(Boolean)
  );
  if (allowedRecipients.size === 0) {
    throw new Error(
      "DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST is required to send email in Development."
    );
  }
  if (!allowedRecipients.has(normalizeEmailAddress(recipient))) {
    throw new Error("Email recipient is not allowlisted for Development.");
  }
};
