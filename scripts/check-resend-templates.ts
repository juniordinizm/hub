import { Resend } from "resend";
import {
  getHostedTemplateMetadata,
  type HostedEmailTemplateName,
  hostedEmailTemplates,
  resolveHostedTemplateAlias,
} from "../src/features/email/templates-contract";

export interface RemoteTemplate {
  alias?: unknown;
  from?: unknown;
  has_unpublished_versions?: unknown;
  html?: unknown;
  published_at?: unknown;
  reply_to?: unknown;
  status?: unknown;
  text?: unknown;
  variables?: unknown;
}

export interface ExpectedTemplateContract {
  alias: string;
  from: string;
  replyTo: readonly string[];
  requiredKeys: readonly string[];
}

export interface TemplateContractEvaluation {
  errors: string[];
  warnings: string[];
}

interface CheckerLogger {
  error(message: string): void;
  log(message: string): void;
  warn(message: string): void;
}

interface CheckerEnvironment {
  RESEND_TEMPLATES_ADMIN_API_KEY?: string | undefined;
}

export type ResendTemplateEnvironment =
  | "development"
  | "staging"
  | "production";

const CATALOG_FROM = "Neuro Capacitar <notificacoes@neurocapacitar.com.br>";
const CATALOG_REPLY_TO = ["suporte@neurocapacitar.com.br"] as const;
const ANGLE_ADDRESS_PATTERN = /<([^<>]+)>$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeEmailAddress = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  const angleAddress = trimmed.match(ANGLE_ADDRESS_PATTERN)?.[1];
  return (angleAddress ?? trimmed).trim();
};

const normalizeReplyTo = (value: unknown): string[] | null => {
  if (typeof value === "string") {
    return [normalizeEmailAddress(value)];
  }

  if (
    Array.isArray(value) &&
    value.every((address): address is string => typeof address === "string")
  ) {
    return value.map(normalizeEmailAddress);
  }

  return null;
};

const evaluatePublishedContract = (
  remote: RemoteTemplate,
  expected: ExpectedTemplateContract
): string[] => {
  const errors: string[] = [];

  if (remote.alias !== expected.alias) {
    errors.push("Template alias does not match the catalog.");
  }

  if (remote.status !== "published") {
    errors.push("Template status must be published.");
  }

  if (
    typeof remote.published_at !== "string" ||
    remote.published_at.trim().length === 0
  ) {
    errors.push("Template published_at is required.");
  }

  if (typeof remote.html !== "string" || remote.html.trim().length === 0) {
    errors.push("Template html must not be empty.");
  }

  if (typeof remote.text !== "string" || remote.text.trim().length === 0) {
    errors.push("Template text must not be empty.");
  }

  return errors;
};

const evaluateEnvelopeContract = (
  remote: RemoteTemplate,
  expected: ExpectedTemplateContract
): string[] => {
  const errors: string[] = [];
  if (remote.from === undefined || remote.from === null) {
    errors.push("Template from is required by the catalog.");
  } else if (
    typeof remote.from !== "string" ||
    normalizeEmailAddress(remote.from) !== normalizeEmailAddress(expected.from)
  ) {
    errors.push("Template from is incompatible with the catalog.");
  }

  if (remote.reply_to === undefined || remote.reply_to === null) {
    errors.push("Template reply_to is required by the catalog.");
  } else {
    const replyTo = normalizeReplyTo(remote.reply_to);
    const expectedReplyTo = expected.replyTo.map(normalizeEmailAddress);
    if (
      replyTo === null ||
      replyTo.length !== expectedReplyTo.length ||
      replyTo.join("\u0000") !== expectedReplyTo.join("\u0000")
    ) {
      errors.push("Template reply_to is incompatible with the catalog.");
    }
  }

  return errors;
};

const evaluateVariableContract = (
  remote: RemoteTemplate,
  expected: ExpectedTemplateContract
): string[] => {
  const errors: string[] = [];
  const variables = Array.isArray(remote.variables) ? remote.variables : [];
  const hasMalformedVariableDefinition = variables.some(
    (variable) => !isRecord(variable) || typeof variable.key !== "string"
  );
  if (hasMalformedVariableDefinition) {
    errors.push("Template variable definition is malformed.");
  }

  for (const requiredKey of expected.requiredKeys) {
    if (
      !variables.some(
        (variable) => isRecord(variable) && variable.key === requiredKey
      )
    ) {
      errors.push(`Template variable ${requiredKey} is missing.`);
    }
  }

  for (const variable of variables) {
    if (!isRecord(variable) || typeof variable.key !== "string") {
      continue;
    }

    if (
      expected.requiredKeys.includes(variable.key) &&
      variable.type !== "string"
    ) {
      errors.push(`Template variable ${variable.key} must be a string.`);
    }
  }

  const variableKeys = variables.flatMap((variable) =>
    isRecord(variable) && typeof variable.key === "string" ? [variable.key] : []
  );
  const hasUnsupportedVariable = variableKeys.some(
    (key) => !expected.requiredKeys.includes(key)
  );
  const hasDuplicateVariable =
    new Set(variableKeys).size !== variableKeys.length;
  if (
    hasMalformedVariableDefinition ||
    hasUnsupportedVariable ||
    hasDuplicateVariable ||
    variableKeys.length !== expected.requiredKeys.length
  ) {
    errors.push("Template variable set does not match the catalog.");
  }

  if (expected.alias === "support-request") {
    const courseTitleVariable = variables.find(
      (variable) => isRecord(variable) && variable.key === "COURSE_TITLE"
    );
    if (
      !isRecord(courseTitleVariable) ||
      courseTitleVariable.fallback_value !== "Não informado"
    ) {
      errors.push(
        'Support COURSE_TITLE must use the fallback "Não informado".'
      );
    }
  }

  return errors;
};

export const evaluateTemplateContract = (
  remote: RemoteTemplate,
  expected: ExpectedTemplateContract
): TemplateContractEvaluation => {
  const errors = [
    ...evaluatePublishedContract(remote, expected),
    ...evaluateEnvelopeContract(remote, expected),
    ...evaluateVariableContract(remote, expected),
  ];

  const warnings =
    errors.length === 0 && remote.has_unpublished_versions === true
      ? ["Template has unpublished versions; the published version passed."]
      : [];

  return { errors, warnings };
};

const expectedTemplateContract = (
  name: HostedEmailTemplateName,
  environment: ResendTemplateEnvironment
): ExpectedTemplateContract => {
  const alias = resolveHostedTemplateAlias({
    name,
    runtimeEnvironment: environment,
  });
  const metadata = getHostedTemplateMetadata(name);

  return {
    alias,
    from: CATALOG_FROM,
    replyTo: CATALOG_REPLY_TO,
    requiredKeys: metadata.requiredKeys,
  };
};

export const runResendTemplateCheck = async ({
  apiKey,
  environment,
}: {
  apiKey: string;
  environment: ResendTemplateEnvironment;
}): Promise<TemplateContractEvaluation> => {
  const resend = new Resend(apiKey);
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const name of hostedEmailTemplates) {
    const expected = expectedTemplateContract(name, environment);

    try {
      const response = await resend.templates.get(expected.alias);
      if (response.error !== null || response.data === null) {
        errors.push(
          `Template ${expected.alias} could not be fetched from Resend.`
        );
        continue;
      }

      const evaluation = evaluateTemplateContract(response.data, expected);
      errors.push(
        ...evaluation.errors.map(
          (error) => `Template ${expected.alias}: ${error}`
        )
      );
      warnings.push(
        ...evaluation.warnings.map(
          (warning) => `Template ${expected.alias}: ${warning}`
        )
      );
    } catch {
      errors.push(
        `Template ${expected.alias} could not be fetched from Resend.`
      );
    }
  }

  return { errors, warnings };
};

const parseEnvironment = (
  args: readonly string[]
): ResendTemplateEnvironment | null => {
  const environmentArgument = args.find((argument) =>
    argument.startsWith("--environment=")
  );
  const value = environmentArgument?.slice("--environment=".length);

  if (
    value === "development" ||
    value === "staging" ||
    value === "production"
  ) {
    return value;
  }

  return null;
};

const readCheckerEnvironment = (): CheckerEnvironment => ({
  RESEND_TEMPLATES_ADMIN_API_KEY: process.env.RESEND_TEMPLATES_ADMIN_API_KEY,
});

export const main = async (
  args: readonly string[] = process.argv.slice(2),
  env: CheckerEnvironment = readCheckerEnvironment(),
  logger: CheckerLogger = console
): Promise<number> => {
  const environment = parseEnvironment(args);
  if (environment === null) {
    logger.error(
      "Use --environment=development, --environment=staging, or --environment=production."
    );
    return 1;
  }

  const apiKey = env.RESEND_TEMPLATES_ADMIN_API_KEY;
  if (!apiKey?.trim()) {
    logger.error(
      "RESEND_TEMPLATES_ADMIN_API_KEY is required to run this checker."
    );
    return 1;
  }

  try {
    const result = await runResendTemplateCheck({
      apiKey,
      environment,
    });

    for (const warning of result.warnings) {
      logger.warn(warning);
    }
    for (const error of result.errors) {
      logger.error(error);
    }

    if (result.errors.length === 0) {
      logger.log("Resend hosted template contract check passed.");
      return 0;
    }

    return 1;
  } catch {
    logger.error("Resend template checker failed safely.");
    return 1;
  }
};

if (import.meta.main) {
  process.exitCode = await main();
}
