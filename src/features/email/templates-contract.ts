export const hostedEmailTemplates = [
  "auth-password-reset",
  "access-released",
  "access-expiry-warning",
  "certificate-issued",
  "course-sales-opened",
  "support-request",
] as const;

export type HostedEmailTemplateName = (typeof hostedEmailTemplates)[number];

interface AuthPasswordResetVariables {
  ACTION_URL: string;
  name: "auth-password-reset";
  USER_NAME: string;
}

interface AccessReleasedVariables {
  ACTION_URL: string;
  COURSE_TITLE: string;
  name: "access-released";
  PASSWORD_RESET_URL: string;
  USER_NAME: string;
}

interface AccessExpiryWarningVariables {
  ACTION_URL: string;
  COURSE_TITLE: string;
  DAYS_REMAINING: string;
  name: "access-expiry-warning";
  USER_NAME: string;
}

interface CertificateIssuedVariables {
  ACTION_URL: string;
  CERTIFICATE_CODE: string;
  COURSE_TITLE: string;
  name: "certificate-issued";
  USER_NAME: string;
}

interface CourseSalesOpenedVariables {
  ACTION_URL: string;
  COURSE_TITLE: string;
  name: "course-sales-opened";
  USER_NAME: string;
}

interface SupportRequestVariables {
  COURSE_TITLE: string;
  MESSAGE: string;
  name: "support-request";
  STUDENT_EMAIL: string;
  STUDENT_NAME: string;
  SUPPORT_SUBJECT: string;
}

export type HostedEmailTemplateVariables =
  | AccessExpiryWarningVariables
  | AccessReleasedVariables
  | AuthPasswordResetVariables
  | CertificateIssuedVariables
  | CourseSalesOpenedVariables
  | SupportRequestVariables;

type HostedEmailTemplateVariableKey =
  | "ACTION_URL"
  | "CERTIFICATE_CODE"
  | "COURSE_TITLE"
  | "DAYS_REMAINING"
  | "MESSAGE"
  | "PASSWORD_RESET_URL"
  | "STUDENT_EMAIL"
  | "STUDENT_NAME"
  | "SUPPORT_SUBJECT"
  | "USER_NAME";

export type HostedEmailTemplateMetadata = Readonly<{
  fromOwner: "hub";
  plainTextMode: "provider-generated";
  replyToOwner: "hub";
  requiredKeys: readonly HostedEmailTemplateVariableKey[];
  subjectOwner: "hub";
}>;

const hostedTemplateMetadata = {
  "access-expiry-warning": {
    fromOwner: "hub",
    plainTextMode: "provider-generated",
    replyToOwner: "hub",
    requiredKeys: ["USER_NAME", "COURSE_TITLE", "DAYS_REMAINING", "ACTION_URL"],
    subjectOwner: "hub",
  },
  "access-released": {
    fromOwner: "hub",
    plainTextMode: "provider-generated",
    replyToOwner: "hub",
    requiredKeys: [
      "USER_NAME",
      "COURSE_TITLE",
      "ACTION_URL",
      "PASSWORD_RESET_URL",
    ],
    subjectOwner: "hub",
  },
  "auth-password-reset": {
    fromOwner: "hub",
    plainTextMode: "provider-generated",
    replyToOwner: "hub",
    requiredKeys: ["USER_NAME", "ACTION_URL"],
    subjectOwner: "hub",
  },
  "certificate-issued": {
    fromOwner: "hub",
    plainTextMode: "provider-generated",
    replyToOwner: "hub",
    requiredKeys: [
      "USER_NAME",
      "COURSE_TITLE",
      "CERTIFICATE_CODE",
      "ACTION_URL",
    ],
    subjectOwner: "hub",
  },
  "course-sales-opened": {
    fromOwner: "hub",
    plainTextMode: "provider-generated",
    replyToOwner: "hub",
    requiredKeys: ["USER_NAME", "COURSE_TITLE", "ACTION_URL"],
    subjectOwner: "hub",
  },
  "support-request": {
    fromOwner: "hub",
    plainTextMode: "provider-generated",
    replyToOwner: "hub",
    requiredKeys: [
      "STUDENT_NAME",
      "STUDENT_EMAIL",
      "COURSE_TITLE",
      "SUPPORT_SUBJECT",
      "MESSAGE",
    ],
    subjectOwner: "hub",
  },
} as const satisfies {
  [name in HostedEmailTemplateName]: HostedEmailTemplateMetadata;
};

const hostedTemplateRuntimes = [
  "development",
  "staging",
  "production",
] as const;
const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;

interface UnknownObject {
  [key: string]: unknown;
}

const hasOwn = (input: UnknownObject, key: string): boolean =>
  Object.hasOwn(input, key);

const isObject = (input: unknown): input is UnknownObject =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const isHostedEmailTemplateName = (
  input: unknown
): input is HostedEmailTemplateName =>
  typeof input === "string" &&
  (hostedEmailTemplates as readonly string[]).includes(input);

const isHostedEmailTemplateVariableKey = (
  input: string
): input is HostedEmailTemplateVariableKey =>
  input === "ACTION_URL" ||
  input === "CERTIFICATE_CODE" ||
  input === "COURSE_TITLE" ||
  input === "DAYS_REMAINING" ||
  input === "MESSAGE" ||
  input === "PASSWORD_RESET_URL" ||
  input === "STUDENT_EMAIL" ||
  input === "STUDENT_NAME" ||
  input === "SUPPORT_SUBJECT" ||
  input === "USER_NAME";

export const resolveHostedTemplateAlias = ({
  name,
  runtimeEnvironment,
}: {
  name: HostedEmailTemplateName;
  runtimeEnvironment: string;
}): HostedEmailTemplateName => {
  if (!isHostedEmailTemplateName(name)) {
    throw new Error("Hosted email template name is invalid.");
  }

  if (
    !(hostedTemplateRuntimes as readonly string[]).includes(runtimeEnvironment)
  ) {
    throw new Error("Hosted email templates are unavailable in this runtime.");
  }

  return name;
};

const assertRequiredTemplateVariables = (
  input: UnknownObject,
  metadata: HostedEmailTemplateMetadata
): void => {
  for (const key of metadata.requiredKeys) {
    if (!hasOwn(input, key)) {
      throw new Error(`Hosted email template variable ${key} is required.`);
    }

    const value = input[key];
    if (typeof value === "string" && value.trim().length === 0) {
      if (key === "MESSAGE") {
        throw new Error("MESSAGE must contain between 1 and 1800 characters.");
      }

      if (key === "SUPPORT_SUBJECT") {
        throw new Error(
          "SUPPORT_SUBJECT must contain between 1 and 160 characters."
        );
      }

      throw new Error(`Hosted email template variable ${key} is required.`);
    }
  }
};

const assertStringTemplateVariables = (
  input: UnknownObject,
  metadata: HostedEmailTemplateMetadata
): void => {
  for (const [key, value] of Object.entries(input)) {
    if (key === "name") {
      continue;
    }

    if (!metadata.requiredKeys.some((requiredKey) => requiredKey === key)) {
      throw new Error(
        "Hosted email template contains an unsupported variable."
      );
    }

    if (typeof value !== "string") {
      throw new Error(
        `Hosted email template variable ${key} must be a string.`
      );
    }
  }
};

const assertTemplateSpecificVariables = (input: UnknownObject): void => {
  if (
    input.name === "access-expiry-warning" &&
    input.DAYS_REMAINING !== "1 dia" &&
    input.DAYS_REMAINING !== "7 dias"
  ) {
    throw new Error("DAYS_REMAINING must be either 1 dia or 7 dias.");
  }

  if (input.name !== "support-request") {
    return;
  }

  const message = input.MESSAGE;
  if (
    typeof message !== "string" ||
    message.length < 1 ||
    message.length > 1800
  ) {
    throw new Error("MESSAGE must contain between 1 and 1800 characters.");
  }

  const subject = input.SUPPORT_SUBJECT;
  if (
    typeof subject !== "string" ||
    subject.length < 1 ||
    subject.length > 160
  ) {
    throw new Error(
      "SUPPORT_SUBJECT must contain between 1 and 160 characters."
    );
  }

  if (CONTROL_CHARACTER_PATTERN.test(subject)) {
    throw new Error("SUPPORT_SUBJECT must not contain control characters.");
  }
};

const assertMaximumVariableLengths = (input: UnknownObject): void => {
  for (const [key, value] of Object.entries(input)) {
    if (key === "name" || !isHostedEmailTemplateVariableKey(key)) {
      continue;
    }

    if (typeof value === "string" && value.length > 2000) {
      throw new Error(
        `Hosted email template variable ${key} must be at most 2000 characters.`
      );
    }
  }
};

export function validateHostedTemplateVariables(
  input: unknown
): asserts input is HostedEmailTemplateVariables {
  if (!(isObject(input) && isHostedEmailTemplateName(input.name))) {
    throw new Error("Invalid hosted email template variables.");
  }

  const metadata = hostedTemplateMetadata[input.name];
  assertRequiredTemplateVariables(input, metadata);
  assertStringTemplateVariables(input, metadata);
  assertTemplateSpecificVariables(input);
  assertMaximumVariableLengths(input);
}

export const getHostedTemplateMetadata = (
  name: HostedEmailTemplateName
): HostedEmailTemplateMetadata => {
  if (!isHostedEmailTemplateName(name)) {
    throw new Error("Hosted email template name is invalid.");
  }

  return hostedTemplateMetadata[name];
};
