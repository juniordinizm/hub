const normalizeEmailAddress = (value: string): string =>
  value.trim().toLowerCase();

interface EmailRecipientBoundaryInput {
  allowlist: string | undefined;
  environment: string;
  recipient: string;
}

export const assertDevelopmentOrStagingEmailRecipientAllowed = ({
  allowlist,
  environment,
  recipient,
}: EmailRecipientBoundaryInput): void => {
  if (environment !== "development" && environment !== "staging") {
    return;
  }

  const environmentLabel =
    environment === "development" ? "Development" : "Staging";
  const allowlistVariable =
    environment === "development"
      ? "DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST"
      : "STAGING_EMAIL_RECIPIENT_ALLOWLIST";
  const allowedRecipients = new Set(
    (allowlist ?? "").split(",").map(normalizeEmailAddress).filter(Boolean)
  );
  if (allowedRecipients.size === 0) {
    throw new Error(
      `${allowlistVariable} is required to send email in ${environmentLabel}.`
    );
  }
  if (!allowedRecipients.has(normalizeEmailAddress(recipient))) {
    throw new Error(
      `Email recipient is not allowlisted for ${environmentLabel}.`
    );
  }
};

export const assertDevelopmentEmailRecipientAllowed = ({
  allowlist,
  environment,
  recipient,
}: EmailRecipientBoundaryInput): void => {
  if (environment !== "development") {
    return;
  }

  assertDevelopmentOrStagingEmailRecipientAllowed({
    allowlist,
    environment: "development",
    recipient,
  });
};
