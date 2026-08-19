import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ExpectedTemplateContract,
  evaluateTemplateContract,
  main,
  type RemoteTemplate,
  runResendTemplateCheck,
} from "../../scripts/check-resend-templates";
import { hostedEmailTemplates } from "../features/email/templates-contract";

const resendMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn(function MockResend() {
    return { templates: { get: resendMock.get } };
  }),
}));

beforeEach(() => {
  resendMock.get.mockReset();
});

const expected: ExpectedTemplateContract = {
  alias: "auth-password-reset",
  from: "Neuro Capacitar <notificacoes@neurocapacitar.com.br>",
  replyTo: ["suporte@neurocapacitar.com.br"],
  requiredKeys: ["USER_NAME", "ACTION_URL"],
};

const publishedTemplate: RemoteTemplate = {
  alias: "auth-password-reset",
  from: "Neuro Capacitar <notificacoes@neurocapacitar.com.br>",
  has_unpublished_versions: false,
  html: "<p>Olá {{{USER_NAME}}}</p>",
  published_at: "2026-08-19T12:00:00.000Z",
  reply_to: ["suporte@neurocapacitar.com.br"],
  status: "published",
  text: "Olá {{{USER_NAME}}}",
  variables: [
    { fallback_value: null, key: "USER_NAME", type: "string" },
    { fallback_value: null, key: "ACTION_URL", type: "string" },
  ],
};

const supportExpected: ExpectedTemplateContract = {
  alias: "support-request",
  from: "Neuro Capacitar <notificacoes@neurocapacitar.com.br>",
  replyTo: ["suporte@neurocapacitar.com.br"],
  requiredKeys: [
    "STUDENT_NAME",
    "STUDENT_EMAIL",
    "COURSE_TITLE",
    "SUPPORT_SUBJECT",
    "MESSAGE",
  ],
};

const supportTemplate: RemoteTemplate = {
  ...publishedTemplate,
  alias: "support-request",
  variables: [
    { fallback_value: null, key: "STUDENT_NAME", type: "string" },
    { fallback_value: null, key: "STUDENT_EMAIL", type: "string" },
    { fallback_value: "Não informado", key: "COURSE_TITLE", type: "string" },
    { fallback_value: null, key: "SUPPORT_SUBJECT", type: "string" },
    { fallback_value: null, key: "MESSAGE", type: "string" },
  ],
};

const requiredKeysByAlias: Record<string, readonly string[]> = {
  "access-expiry-warning": [
    "USER_NAME",
    "COURSE_TITLE",
    "DAYS_REMAINING",
    "ACTION_URL",
  ],
  "access-released": [
    "USER_NAME",
    "COURSE_TITLE",
    "ACTION_URL",
    "PASSWORD_RESET_URL",
  ],
  "auth-password-reset": ["USER_NAME", "ACTION_URL"],
  "certificate-issued": [
    "USER_NAME",
    "COURSE_TITLE",
    "CERTIFICATE_CODE",
    "ACTION_URL",
  ],
  "course-sales-opened": ["USER_NAME", "COURSE_TITLE", "ACTION_URL"],
  "support-request": [
    "STUDENT_NAME",
    "STUDENT_EMAIL",
    "COURSE_TITLE",
    "SUPPORT_SUBJECT",
    "MESSAGE",
  ],
};

const remoteForAlias = (alias: string): RemoteTemplate => ({
  alias,
  from: expected.from,
  has_unpublished_versions: false,
  html: `<p>${alias}</p>`,
  published_at: "2026-08-19T12:00:00.000Z",
  reply_to: expected.replyTo,
  status: "published",
  text: alias,
  variables: (requiredKeysByAlias[alias] ?? []).map((key) => ({
    fallback_value:
      alias === "support-request" && key === "COURSE_TITLE"
        ? "Não informado"
        : null,
    key,
    type: "string",
  })),
});

describe("evaluateTemplateContract", () => {
  it("accepts a published template matching its catalog contract", () => {
    expect(evaluateTemplateContract(publishedTemplate, expected)).toEqual({
      errors: [],
      warnings: [],
    });
  });

  it("rejects a template returned under the wrong alias", () => {
    const result = evaluateTemplateContract(
      { ...publishedTemplate, alias: "access-released" },
      expected
    );

    expect(result.errors).toContain(
      "Template alias does not match the catalog."
    );
  });

  it("rejects a draft template", () => {
    const result = evaluateTemplateContract(
      { ...publishedTemplate, status: "draft" },
      expected
    );

    expect(result.errors).toContain("Template status must be published.");
  });

  it("rejects a published template without published_at", () => {
    const result = evaluateTemplateContract(
      { ...publishedTemplate, published_at: null },
      expected
    );

    expect(result.errors).toContain("Template published_at is required.");
  });

  it("rejects an empty html body", () => {
    const result = evaluateTemplateContract(
      { ...publishedTemplate, html: "   " },
      expected
    );

    expect(result.errors).toContain("Template html must not be empty.");
  });

  it("rejects an empty plain text body", () => {
    const result = evaluateTemplateContract(
      { ...publishedTemplate, text: "" },
      expected
    );

    expect(result.errors).toContain("Template text must not be empty.");
  });

  it("rejects a template with a malformed variable definition", () => {
    const result = evaluateTemplateContract(
      {
        ...publishedTemplate,
        variables: [
          { fallback_value: null, key: "USER_NAME", type: "string" },
          { fallback_value: null, key: "ACTION_URL", type: "string" },
          {},
        ],
      },
      expected
    );

    expect(result.errors).toContain(
      "Template variable definition is malformed."
    );
    expect(result.errors).toContain(
      "Template variable set does not match the catalog."
    );
  });

  it("rejects a variable definition with a non-string key", () => {
    const result = evaluateTemplateContract(
      {
        ...publishedTemplate,
        variables: [
          { fallback_value: null, key: "USER_NAME", type: "string" },
          { fallback_value: null, key: "ACTION_URL", type: "string" },
          { fallback_value: null, key: 42, type: "string" },
        ],
      },
      expected
    );

    expect(result.errors).toContain(
      "Template variable definition is malformed."
    );
  });

  it("rejects a template missing a required variable", () => {
    const result = evaluateTemplateContract(
      {
        ...publishedTemplate,
        variables: [{ fallback_value: null, key: "USER_NAME", type: "string" }],
      },
      expected
    );

    expect(result.errors).toContain("Template variable ACTION_URL is missing.");
  });

  it("rejects a required variable with a non-string type", () => {
    const result = evaluateTemplateContract(
      {
        ...publishedTemplate,
        variables: [
          { fallback_value: null, key: "USER_NAME", type: "string" },
          { fallback_value: null, key: "ACTION_URL", type: "number" },
        ],
      },
      expected
    );

    expect(result.errors).toContain(
      "Template variable ACTION_URL must be a string."
    );
  });

  it("rejects variables outside the exact catalog set", () => {
    const result = evaluateTemplateContract(
      {
        ...publishedTemplate,
        variables: [
          { fallback_value: null, key: "USER_NAME", type: "string" },
          { fallback_value: null, key: "ACTION_URL", type: "string" },
          { fallback_value: null, key: "EXTRA", type: "string" },
        ],
      },
      expected
    );

    expect(result.errors).toContain(
      "Template variable set does not match the catalog."
    );
  });

  it("rejects duplicate variables even when required keys are present", () => {
    const result = evaluateTemplateContract(
      {
        ...publishedTemplate,
        variables: [
          { fallback_value: null, key: "USER_NAME", type: "string" },
          { fallback_value: null, key: "USER_NAME", type: "string" },
          { fallback_value: null, key: "ACTION_URL", type: "string" },
        ],
      },
      expected
    );

    expect(result.errors).toContain(
      "Template variable set does not match the catalog."
    );
  });

  it("requires the support course title fallback", () => {
    const result = evaluateTemplateContract(
      {
        ...supportTemplate,
        variables: [
          { fallback_value: null, key: "STUDENT_NAME", type: "string" },
          { fallback_value: null, key: "STUDENT_EMAIL", type: "string" },
          { fallback_value: null, key: "COURSE_TITLE", type: "string" },
          { fallback_value: null, key: "SUPPORT_SUBJECT", type: "string" },
          { fallback_value: null, key: "MESSAGE", type: "string" },
        ],
      },
      supportExpected
    );

    expect(result.errors).toContain(
      'Support COURSE_TITLE must use the fallback "Não informado".'
    );
  });

  it("warns about unpublished versions without failing a valid published version", () => {
    expect(
      evaluateTemplateContract(
        { ...publishedTemplate, has_unpublished_versions: true },
        expected
      )
    ).toEqual({
      errors: [],
      warnings: [
        "Template has unpublished versions; the published version passed.",
      ],
    });
  });

  it("does not emit the unpublished warning when the published version is invalid", () => {
    const result = evaluateTemplateContract(
      { ...publishedTemplate, has_unpublished_versions: true, status: "draft" },
      expected
    );

    expect(result.errors).toContain("Template status must be published.");
    expect(result.warnings).toEqual([]);
  });

  it("rejects an incompatible sender when from is present", () => {
    const result = evaluateTemplateContract(
      { ...publishedTemplate, from: "Other <other@example.test>" },
      expected
    );

    expect(result.errors).toContain(
      "Template from is incompatible with the catalog."
    );
  });

  it("rejects an absent sender", () => {
    const remoteWithoutFrom: RemoteTemplate = { ...publishedTemplate };
    remoteWithoutFrom.from = undefined;

    const result = evaluateTemplateContract(remoteWithoutFrom, expected);

    expect(result.errors).toContain(
      "Template from is required by the catalog."
    );
  });

  it("rejects a null sender", () => {
    const result = evaluateTemplateContract(
      { ...publishedTemplate, from: null },
      expected
    );

    expect(result.errors).toContain(
      "Template from is required by the catalog."
    );
  });

  it("rejects an incompatible reply-to when reply_to is present", () => {
    const result = evaluateTemplateContract(
      { ...publishedTemplate, reply_to: ["other@example.test"] },
      expected
    );

    expect(result.errors).toContain(
      "Template reply_to is incompatible with the catalog."
    );
  });

  it("rejects an absent reply-to", () => {
    const remoteWithoutReplyTo: RemoteTemplate = { ...publishedTemplate };
    remoteWithoutReplyTo.reply_to = undefined;

    const result = evaluateTemplateContract(remoteWithoutReplyTo, expected);

    expect(result.errors).toContain(
      "Template reply_to is required by the catalog."
    );
  });

  it("rejects a null reply-to", () => {
    const result = evaluateTemplateContract(
      { ...publishedTemplate, reply_to: null },
      expected
    );

    expect(result.errors).toContain(
      "Template reply_to is required by the catalog."
    );
  });
});

describe("runResendTemplateCheck", () => {
  it("fetches each catalog alias exactly once without network access in the test", async () => {
    resendMock.get.mockImplementation(async (alias: string) => ({
      data: remoteForAlias(alias),
      error: null,
    }));

    await expect(
      runResendTemplateCheck({
        apiKey: "re_admin_test",
        environment: "production",
      })
    ).resolves.toEqual({ errors: [], warnings: [] });

    expect(resendMock.get.mock.calls.map(([alias]) => alias)).toEqual(
      hostedEmailTemplates
    );
  });

  it("returns a sanitized error for every failed fetch", async () => {
    const apiKey = "re_admin_secret_should_not_print";
    const providerError =
      "request failed for student@example.test with body <private-html>";
    resendMock.get.mockRejectedValue(new Error(providerError));

    const result = await runResendTemplateCheck({
      apiKey,
      environment: "production",
    });

    expect(result.errors).toHaveLength(hostedEmailTemplates.length);
    expect(result.errors.join(" ")).not.toContain(apiKey);
    expect(result.errors.join(" ")).not.toContain(providerError);
    expect(result.errors.join(" ")).not.toContain("student@example.test");
    expect(
      result.errors.every((error) => error.includes("could not be fetched"))
    ).toBe(true);
  });
});

const createLogger = () => ({
  error: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
});

describe("main", () => {
  it("returns exit code 1 when the admin key is absent", async () => {
    const logger = createLogger();

    await expect(main(["--environment=production"], {}, logger)).resolves.toBe(
      1
    );

    expect(logger.error).toHaveBeenCalledWith(
      "RESEND_TEMPLATES_ADMIN_API_KEY is required to run this checker."
    );
    expect(resendMock.get).not.toHaveBeenCalled();
  });

  it("returns exit code 0 for six valid templates", async () => {
    resendMock.get.mockImplementation(async (alias: string) => ({
      data: remoteForAlias(alias),
      error: null,
    }));
    const logger = createLogger();

    await expect(
      main(
        ["--environment=production"],
        { RESEND_TEMPLATES_ADMIN_API_KEY: "re_admin_test" },
        logger
      )
    ).resolves.toBe(0);

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      "Resend hosted template contract check passed."
    );
  });

  it("returns exit code 0 and warns when a valid template has unpublished versions", async () => {
    resendMock.get.mockImplementation(async (alias: string) => ({
      data: {
        ...remoteForAlias(alias),
        has_unpublished_versions: alias === "support-request",
      },
      error: null,
    }));
    const logger = createLogger();

    await expect(
      main(
        ["--environment=staging"],
        { RESEND_TEMPLATES_ADMIN_API_KEY: "re_admin_test" },
        logger
      )
    ).resolves.toBe(0);

    expect(logger.warn).toHaveBeenCalledWith(
      "Template support-request: Template has unpublished versions; the published version passed."
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("returns exit code 1 for a fetch failure without printing provider details", async () => {
    const secret = "re_admin_secret_should_not_print";
    resendMock.get.mockRejectedValue(
      new Error("provider PII private@example.test <html> secret")
    );
    const logger = createLogger();

    await expect(
      main(
        ["--environment=development"],
        { RESEND_TEMPLATES_ADMIN_API_KEY: secret },
        logger
      )
    ).resolves.toBe(1);

    const output = JSON.stringify(logger.error.mock.calls);
    expect(output).toContain("could not be fetched");
    expect(output).not.toContain(secret);
    expect(output).not.toContain("private@example.test");
    expect(output).not.toContain("<html>");
  });

  it("returns exit code 1 for an alias contract mismatch without printing remote content", async () => {
    resendMock.get.mockImplementation(async (alias: string) => ({
      data: {
        ...remoteForAlias(alias),
        alias: alias === "auth-password-reset" ? "wrong-alias" : alias,
        html: "<private-user-content>student@example.test</private-user-content>",
      },
      error: null,
    }));
    const logger = createLogger();

    await expect(
      main(
        ["--environment=production"],
        { RESEND_TEMPLATES_ADMIN_API_KEY: "re_admin_test" },
        logger
      )
    ).resolves.toBe(1);

    const output = JSON.stringify(logger.error.mock.calls);
    expect(output).toContain("Template auth-password-reset:");
    expect(output).toContain("Template alias does not match the catalog.");
    expect(output).not.toContain("student@example.test");
    expect(output).not.toContain("private-user-content");
  });

  it("returns exit code 1 for a variable contract mismatch", async () => {
    resendMock.get.mockImplementation(async (alias: string) => ({
      data: {
        ...remoteForAlias(alias),
        variables:
          alias === "course-sales-opened"
            ? [{ fallback_value: null, key: "USER_NAME", type: "number" }]
            : remoteForAlias(alias).variables,
      },
      error: null,
    }));
    const logger = createLogger();

    await expect(
      main(
        ["--environment=production"],
        { RESEND_TEMPLATES_ADMIN_API_KEY: "re_admin_test" },
        logger
      )
    ).resolves.toBe(1);

    expect(JSON.stringify(logger.error.mock.calls)).toContain(
      "Template course-sales-opened: Template variable ACTION_URL is missing."
    );
  });

  it("rejects an unsupported environment before constructing the SDK", async () => {
    const logger = createLogger();

    await expect(
      main(
        ["--environment=preview"],
        { RESEND_TEMPLATES_ADMIN_API_KEY: "re_admin_test" },
        logger
      )
    ).resolves.toBe(1);

    expect(logger.error).toHaveBeenCalledWith(
      "Use --environment=development, --environment=staging, or --environment=production."
    );
    expect(resendMock.get).not.toHaveBeenCalled();
  });
});
