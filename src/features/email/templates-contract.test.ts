import { describe, expect, it } from "vitest";
import type { HostedEmailTemplateVariables } from "./templates-contract";
import {
  getHostedTemplateMetadata,
  hostedEmailTemplates,
  resolveHostedTemplateAlias,
  validateHostedTemplateVariables,
} from "./templates-contract";

const validAuthPasswordReset = {
  ACTION_URL: "https://example.test/reset/token",
  name: "auth-password-reset",
  USER_NAME: "Aluna de teste",
} satisfies HostedEmailTemplateVariables;

const validAccessReleased = {
  ACTION_URL: "https://example.test/app/cursos/curso-1",
  COURSE_TITLE: "Curso de teste",
  name: "access-released",
  PASSWORD_RESET_URL: "https://example.test/recuperar-senha",
  USER_NAME: "Aluna de teste",
} satisfies HostedEmailTemplateVariables;

const validAccessExpiryWarning = {
  ACTION_URL: "https://example.test/app/cursos/curso-1",
  COURSE_TITLE: "Curso de teste",
  DAYS_REMAINING: "7 dias",
  name: "access-expiry-warning",
  USER_NAME: "Aluna de teste",
} satisfies HostedEmailTemplateVariables;

const validCertificateIssued = {
  ACTION_URL: "https://example.test/certificados/CERT-123",
  CERTIFICATE_CODE: "CERT-123",
  COURSE_TITLE: "Curso de teste",
  name: "certificate-issued",
  USER_NAME: "Aluna de teste",
} satisfies HostedEmailTemplateVariables;

const validCourseSalesOpened = {
  ACTION_URL: "https://example.test/comprar/curso-de-teste",
  COURSE_TITLE: "Curso de teste",
  name: "course-sales-opened",
  USER_NAME: "Aluna de teste",
} satisfies HostedEmailTemplateVariables;

const validSupportRequest = {
  COURSE_TITLE: "Curso de teste",
  MESSAGE: "Preciso de ajuda para acessar o curso.",
  name: "support-request",
  STUDENT_EMAIL: "aluna@example.test",
  STUDENT_NAME: "Aluna de teste",
  SUPPORT_SUBJECT: "Não consigo acessar o curso",
} satisfies HostedEmailTemplateVariables;

const validVariables = [
  validAuthPasswordReset,
  validAccessReleased,
  validAccessExpiryWarning,
  validCertificateIssued,
  validCourseSalesOpened,
  validSupportRequest,
];

const longString = (length: number): string => "x".repeat(length);

describe("hosted Resend template aliases", () => {
  it("exposes the six logical names as the canonical aliases", () => {
    expect(hostedEmailTemplates).toEqual([
      "auth-password-reset",
      "access-released",
      "access-expiry-warning",
      "certificate-issued",
      "course-sales-opened",
      "support-request",
    ]);
  });

  it.each([
    "development",
    "staging",
    "production",
  ] as const)("resolves %s to the same alias for every template", (runtimeEnvironment) => {
    for (const name of hostedEmailTemplates) {
      expect(resolveHostedTemplateAlias({ name, runtimeEnvironment })).toBe(
        name
      );
    }
  });

  it.each([
    "preview",
    "e2e",
    "unknown",
  ])("rejects runtime %s", (runtimeEnvironment) => {
    expect(() =>
      resolveHostedTemplateAlias({
        name: "auth-password-reset",
        runtimeEnvironment,
      })
    ).toThrow("Hosted email templates are unavailable in this runtime.");
  });
});

describe("hosted template variables", () => {
  it.each(validVariables)("accepts valid variables for $name", (input) => {
    expect(() => validateHostedTemplateVariables(input)).not.toThrow();
  });

  it("rejects variables that belong to another template", () => {
    expect(() =>
      validateHostedTemplateVariables({
        ...validAuthPasswordReset,
        COURSE_TITLE: "Curso indevido",
      })
    ).toThrow("Hosted email template contains an unsupported variable.");

    expect(() =>
      validateHostedTemplateVariables({
        ...validSupportRequest,
        ACTION_URL: "https://example.test/indevido",
      })
    ).toThrow("Hosted email template contains an unsupported variable.");
  });

  it("requires the action URL for authentication reset", () => {
    expect(() =>
      validateHostedTemplateVariables({
        name: "auth-password-reset",
        USER_NAME: "Aluna de teste",
      })
    ).toThrow("ACTION_URL is required");
  });

  it.each([
    "",
    "   ",
  ])("rejects a blank required ACTION_URL value %j", (actionUrl) => {
    expect(() =>
      validateHostedTemplateVariables({
        ...validAuthPasswordReset,
        ACTION_URL: actionUrl,
      })
    ).toThrow("ACTION_URL is required");
  });

  it("requires both action and password reset URLs for released access", () => {
    expect(() =>
      validateHostedTemplateVariables({
        COURSE_TITLE: "Curso de teste",
        name: "access-released",
        USER_NAME: "Aluna de teste",
      })
    ).toThrow("ACTION_URL is required");

    expect(() =>
      validateHostedTemplateVariables({
        ACTION_URL: "https://example.test/app/cursos/curso-1",
        COURSE_TITLE: "Curso de teste",
        name: "access-released",
        USER_NAME: "Aluna de teste",
      })
    ).toThrow("PASSWORD_RESET_URL is required");
  });

  it("requires the certificate code for certificate delivery", () => {
    expect(() =>
      validateHostedTemplateVariables({
        ACTION_URL: "https://example.test/certificados/CERT-123",
        COURSE_TITLE: "Curso de teste",
        name: "certificate-issued",
        USER_NAME: "Aluna de teste",
      })
    ).toThrow("CERTIFICATE_CODE is required");
  });

  it("rejects non-string variables", () => {
    expect(() =>
      validateHostedTemplateVariables({
        ACTION_URL: 123,
        COURSE_TITLE: "Curso de teste",
        name: "course-sales-opened",
        USER_NAME: "Aluna de teste",
      })
    ).toThrow("ACTION_URL must be a string");

    expect(() =>
      validateHostedTemplateVariables({
        ACTION_URL: "https://example.test/app/cursos/curso-1",
        COURSE_TITLE: "Curso de teste",
        DAYS_REMAINING: 7,
        name: "access-expiry-warning",
        USER_NAME: "Aluna de teste",
      })
    ).toThrow("DAYS_REMAINING must be a string");

    expect(() =>
      validateHostedTemplateVariables({
        COURSE_TITLE: 42,
        MESSAGE: "Mensagem válida",
        name: "support-request",
        STUDENT_EMAIL: "aluna@example.test",
        STUDENT_NAME: "Aluna de teste",
        SUPPORT_SUBJECT: "Assunto válido",
      })
    ).toThrow("COURSE_TITLE must be a string");
  });

  it.each([
    "1 dia",
    "7 dias",
  ])("accepts the supported access-expiry value %s", (daysRemaining) => {
    expect(() =>
      validateHostedTemplateVariables({
        ...validAccessExpiryWarning,
        DAYS_REMAINING: daysRemaining,
      })
    ).not.toThrow();
  });

  it("rejects unsupported access-expiry values", () => {
    expect(() =>
      validateHostedTemplateVariables({
        ...validAccessExpiryWarning,
        DAYS_REMAINING: "2 dias",
      })
    ).toThrow("DAYS_REMAINING must be either 1 dia or 7 dias");
  });

  it("enforces the 2000-character maximum for every string", () => {
    const unsafeValue = longString(2001);

    expect(() =>
      validateHostedTemplateVariables({
        ...validAuthPasswordReset,
        USER_NAME: unsafeValue,
      })
    ).toThrow("must be at most 2000 characters");
  });

  it("enforces support-specific lengths", () => {
    expect(() =>
      validateHostedTemplateVariables({
        ...validSupportRequest,
        MESSAGE: "",
      })
    ).toThrow("MESSAGE must contain between 1 and 1800 characters");

    expect(() =>
      validateHostedTemplateVariables({
        ...validSupportRequest,
        MESSAGE: longString(1801),
      })
    ).toThrow("MESSAGE must contain between 1 and 1800 characters");

    expect(() =>
      validateHostedTemplateVariables({
        ...validSupportRequest,
        SUPPORT_SUBJECT: longString(161),
      })
    ).toThrow("SUPPORT_SUBJECT must contain between 1 and 160 characters");
  });

  it("rejects control characters in SUPPORT_SUBJECT without echoing it", () => {
    const unsafeSubject = "Acesso\nindevido";

    let thrownError: unknown;
    try {
      validateHostedTemplateVariables({
        ...validSupportRequest,
        SUPPORT_SUBJECT: unsafeSubject,
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);
    expect((thrownError as Error).message).toBe(
      "SUPPORT_SUBJECT must not contain control characters."
    );
    expect((thrownError as Error).message).not.toContain(unsafeSubject);
  });

  it("does not echo untrusted values in validation errors", () => {
    const unsafeValue = "student-secret@example.test";

    let thrownError: unknown;
    try {
      validateHostedTemplateVariables({
        ...validSupportRequest,
        STUDENT_EMAIL: unsafeValue,
        SUPPORT_SUBJECT: "",
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);
    expect((thrownError as Error).message).not.toContain(unsafeValue);
  });
});

describe("hosted template metadata", () => {
  it.each([
    ["auth-password-reset", ["USER_NAME", "ACTION_URL"]],
    [
      "access-released",
      ["USER_NAME", "COURSE_TITLE", "ACTION_URL", "PASSWORD_RESET_URL"],
    ],
    [
      "access-expiry-warning",
      ["USER_NAME", "COURSE_TITLE", "DAYS_REMAINING", "ACTION_URL"],
    ],
    [
      "certificate-issued",
      ["USER_NAME", "COURSE_TITLE", "CERTIFICATE_CODE", "ACTION_URL"],
    ],
    ["course-sales-opened", ["USER_NAME", "COURSE_TITLE", "ACTION_URL"]],
    [
      "support-request",
      [
        "STUDENT_NAME",
        "STUDENT_EMAIL",
        "COURSE_TITLE",
        "SUPPORT_SUBJECT",
        "MESSAGE",
      ],
    ],
  ] as const)("returns ownership and required keys for %s", (name, requiredKeys) => {
    expect(getHostedTemplateMetadata(name)).toEqual({
      fromOwner: "hub",
      plainTextMode: "provider-generated",
      replyToOwner: "hub",
      requiredKeys,
      subjectOwner: "hub",
    });
  });
});
