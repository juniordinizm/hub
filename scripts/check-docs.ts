import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";

const CANONICAL_DOCUMENT_PATHS = [
  "README.md",
  "PRODUCT.md",
  "CONTEXT.md",
  "docs/README.md",
  "docs/architecture.md",
  "docs/decisions.md",
  "docs/domain/identity-and-authorization.md",
  "docs/domain/commerce-and-access.md",
  "docs/domain/learning-content-and-progress.md",
  "docs/domain/certificates-and-data-rights.md",
  "docs/integrations/abacatepay.md",
  "docs/integrations/jmvstream.md",
  "docs/integrations/r2.md",
  "docs/operations/environment-and-local-development.md",
  "docs/operations/database-and-migrations.md",
  "docs/operations/deploy-and-incidents.md",
  "docs/adr/0001-custom-rbac.md",
  "docs/adr/0002-r2-buckets-and-publication.md",
  "docs/adr/0003-jmvstream-direct-multipart-upload.md",
  "docs/adr/0004-access-grants-and-enrollment-projection.md",
  "docs/adr/0005-financial-precedence-and-manual-review.md",
  "docs/adr/0006-certificate-lifecycle.md",
] as const;

const REMOVED_DOCUMENT_PATHS = [
  "docs/AUTH_MODULE.md",
  "docs/auth-audit-report.md",
  "docs/banner-image-loading-research.md",
  "docs/business-rules/decision-register.md",
  "docs/business-rules/discovery/actors-and-permissions.md",
  "docs/business-rules/discovery/contradictions-and-gaps.md",
  "docs/business-rules/discovery/documentation-plan.md",
  "docs/business-rules/discovery/entities-and-states.md",
  "docs/business-rules/discovery/external-sources.md",
  "docs/business-rules/discovery/flow-map.md",
  "docs/business-rules/discovery/invariants.md",
  "docs/business-rules/discovery/open-questions.md",
  "docs/business-rules/discovery/README.md",
  "docs/business-rules/discovery/rule-inventory.md",
  "docs/business-rules/discovery/system-map.md",
  "docs/business-rules/discovery/traceability-matrix.md",
  "docs/business-rules/glossary.md",
  "docs/business-rules/README.md",
  "docs/DEPLOY_CHECKLIST.md",
  "docs/JMVSTREAM_SETUP.md",
  "docs/JMVSTREAM_UPLOAD_MODULE.md",
  "docs/PLAN.md",
  "docs/prds/2026-07-18-r2-media.md",
  "docs/protear-arquitetura-organizada.md",
  "docs/R2-CONFIGURACAO.md",
  "docs/remediation-pr-plan.md",
  "docs/sistema de expiracao.md",
  "docs/superpowers/plans/2026-07-17-jmvstream-upload-reliability.md",
  "docs/superpowers/plans/2026-07-17-ui-trust-and-auth-continuity.md",
  "docs/superpowers/specs/2026-07-17-jmvstream-upload-reliability-design.md",
  "plans/001-r2-media-boundary.md",
  "plans/002-r2-publication-lifecycle.md",
] as const;

const MIGRATED_ORIGINAL_DOCUMENT_PATHS = [
  "README.md",
  "PRODUCT.md",
  ...REMOVED_DOCUMENT_PATHS,
] as const;

const REQUIRED_METADATA = ["status", "owner", "last_verified_commit"] as const;
const METADATA_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const MARKDOWN_LINK = /!?\[[^\]]*]\(([^)]+)\)/g;
const STABLE_ID_HEADING = /^#{1,6}\s+((?:REG|DEC-DISC|ADR)-[A-Z0-9-]+)\b/gm;
const LINE_BREAK = /\r?\n/;
const LINK_TITLE_SEPARATOR = /\s+["']/u;
const ANGLE_BRACKETS = /^<|>$/g;
const URI_SCHEME = /^[a-z][a-z\d+.-]*:/iu;
const ENV_ASSIGNMENT = /^\s*([A-Z][A-Z0-9_]*)\s*=/;

interface ValidationOptions {
  commitExists?: (commit: string) => boolean;
  documentPaths?: readonly string[];
  environmentDocumentPath?: string;
  migratedOriginalDocumentPaths?: readonly string[];
  migrationLedgerDocumentPath?: string;
  removedDocumentPaths?: readonly string[];
  rootDirectory: string;
}

interface DocumentValidationContext {
  commitExists: (commit: string) => boolean;
  rootDirectory: string;
  stableIdDefinitions: Map<string, string>;
  verifiedCommits: Map<string, boolean>;
}

const parseMetadata = (content: string): Map<string, string> => {
  const match = content.match(METADATA_BLOCK);
  const metadata = new Map<string, string>();

  if (!match?.[1]) {
    return metadata;
  }

  for (const line of match[1].split(LINE_BREAK)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    metadata.set(key, value);
  }

  return metadata;
};

const defaultCommitExists = (
  rootDirectory: string,
  commit: string
): boolean => {
  try {
    execFileSync("git", ["cat-file", "-e", `${commit}^{commit}`], {
      cwd: rootDirectory,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
};

const normalizedLinkTarget = (rawTarget: string): string => {
  const targetWithoutTitle =
    rawTarget.trim().split(LINK_TITLE_SEPARATOR, 1)[0] ?? "";
  const withoutBrackets = targetWithoutTitle.replace(ANGLE_BRACKETS, "");
  const withoutFragment = withoutBrackets.split("#", 1)[0] ?? "";

  try {
    return decodeURIComponent(withoutFragment);
  } catch {
    return withoutFragment;
  }
};

const validateRelativeLinks = (
  rootDirectory: string,
  documentPath: string,
  content: string
): string[] => {
  const errors: string[] = [];

  for (const match of content.matchAll(MARKDOWN_LINK)) {
    const rawTarget = match[1]?.trim() ?? "";
    if (
      rawTarget.length === 0 ||
      rawTarget.startsWith("#") ||
      rawTarget.startsWith("/") ||
      URI_SCHEME.test(rawTarget)
    ) {
      continue;
    }

    const target = normalizedLinkTarget(rawTarget);
    if (target.length === 0) {
      continue;
    }

    const absoluteTarget = resolve(
      rootDirectory,
      dirname(documentPath),
      target
    );
    if (!existsSync(absoluteTarget)) {
      errors.push(
        `${documentPath}: link relativo aponta para arquivo ausente: ${target}`
      );
    }
  }

  return errors;
};

const environmentVariablesFromExample = (rootDirectory: string): string[] => {
  const examplePath = resolve(rootDirectory, ".env.example");
  if (!existsSync(examplePath)) {
    return [];
  }

  const variables: string[] = [];
  for (const line of readFileSync(examplePath, "utf8").split(LINE_BREAK)) {
    const match = line.match(ENV_ASSIGNMENT);
    if (match?.[1]) {
      variables.push(match[1]);
    }
  }
  return variables;
};

const validateMetadata = ({
  commitExists,
  content,
  documentPath,
  verifiedCommits,
}: Pick<DocumentValidationContext, "commitExists" | "verifiedCommits"> & {
  content: string;
  documentPath: string;
}): string[] => {
  const errors: string[] = [];
  const metadata = parseMetadata(content);

  for (const key of REQUIRED_METADATA) {
    if (!metadata.get(key)) {
      errors.push(`${documentPath}: metadado obrigatório ausente: ${key}`);
    }
  }

  const verifiedCommit = metadata.get("last_verified_commit");
  if (!verifiedCommit) {
    return errors;
  }

  const exists =
    verifiedCommits.get(verifiedCommit) ?? commitExists(verifiedCommit);
  verifiedCommits.set(verifiedCommit, exists);
  if (!exists) {
    errors.push(
      `${documentPath}: last_verified_commit não existe: ${verifiedCommit}`
    );
  }

  return errors;
};

const validateStableIdHeadings = ({
  content,
  documentPath,
  stableIdDefinitions,
}: Pick<DocumentValidationContext, "stableIdDefinitions"> & {
  content: string;
  documentPath: string;
}): string[] => {
  const errors: string[] = [];

  for (const match of content.matchAll(STABLE_ID_HEADING)) {
    const stableId = match[1];
    if (!stableId) {
      continue;
    }

    const previousDocument = stableIdDefinitions.get(stableId);
    if (previousDocument) {
      errors.push(
        `${documentPath}: ID duplicado ${stableId}; já definido em ${previousDocument}`
      );
      continue;
    }

    stableIdDefinitions.set(stableId, documentPath);
  }

  return errors;
};

const loadAndValidateDocuments = (
  documentPaths: readonly string[],
  context: DocumentValidationContext
): { documents: Map<string, string>; errors: string[] } => {
  const documents = new Map<string, string>();
  const errors: string[] = [];

  for (const documentPath of documentPaths) {
    const absolutePath = resolve(context.rootDirectory, documentPath);
    if (!existsSync(absolutePath)) {
      errors.push(`${documentPath}: documento canônico ausente`);
      continue;
    }

    const content = readFileSync(absolutePath, "utf8");
    documents.set(documentPath, content);
    errors.push(
      ...validateMetadata({ ...context, content, documentPath }),
      ...validateRelativeLinks(context.rootDirectory, documentPath, content),
      ...validateStableIdHeadings({ ...context, content, documentPath })
    );
  }

  return { documents, errors };
};

const validateRemovedReferences = ({
  documents,
  migrationLedgerDocumentPath,
  removedDocumentPaths,
}: {
  documents: Map<string, string>;
  migrationLedgerDocumentPath: string;
  removedDocumentPaths: readonly string[];
}): string[] => {
  const errors: string[] = [];

  for (const [documentPath, content] of documents) {
    if (documentPath === migrationLedgerDocumentPath) {
      continue;
    }

    for (const removedPath of removedDocumentPaths) {
      if (content.includes(removedPath)) {
        errors.push(
          `${documentPath}: referência a documento removido: ${removedPath}`
        );
      }
    }
  }

  return errors;
};

const validateMigrationLedger = ({
  ledger,
  migrationLedgerDocumentPath,
  migratedOriginalDocumentPaths,
}: {
  ledger: string;
  migrationLedgerDocumentPath: string;
  migratedOriginalDocumentPaths: readonly string[];
}): string[] =>
  migratedOriginalDocumentPaths
    .filter((originalPath) => !ledger.includes(`\`${originalPath}\``))
    .map(
      (originalPath) =>
        `${migrationLedgerDocumentPath}: documento original sem destino no registro de migração: ${originalPath}`
    );

const validateEnvironmentCoverage = ({
  environmentDocument,
  environmentDocumentPath,
  rootDirectory,
}: {
  environmentDocument: string;
  environmentDocumentPath: string;
  rootDirectory: string;
}): string[] =>
  environmentVariablesFromExample(rootDirectory)
    .filter((variable) => !environmentDocument.includes(variable))
    .map(
      (variable) =>
        `${environmentDocumentPath}: variável de .env.example sem cobertura: ${variable}`
    );

export const validateDocumentation = ({
  rootDirectory,
  documentPaths = CANONICAL_DOCUMENT_PATHS,
  environmentDocumentPath = "docs/operations/environment-and-local-development.md",
  migrationLedgerDocumentPath = "docs/README.md",
  migratedOriginalDocumentPaths = MIGRATED_ORIGINAL_DOCUMENT_PATHS,
  removedDocumentPaths = REMOVED_DOCUMENT_PATHS,
  commitExists = (commit) => defaultCommitExists(rootDirectory, commit),
}: ValidationOptions): string[] => {
  const { documents, errors } = loadAndValidateDocuments(documentPaths, {
    commitExists,
    rootDirectory,
    stableIdDefinitions: new Map<string, string>(),
    verifiedCommits: new Map<string, boolean>(),
  });

  return [
    ...errors,
    ...validateRemovedReferences({
      documents,
      migrationLedgerDocumentPath,
      removedDocumentPaths,
    }),
    ...validateMigrationLedger({
      ledger: documents.get(migrationLedgerDocumentPath) ?? "",
      migrationLedgerDocumentPath,
      migratedOriginalDocumentPaths,
    }),
    ...validateEnvironmentCoverage({
      environmentDocument: documents.get(environmentDocumentPath) ?? "",
      environmentDocumentPath,
      rootDirectory,
    }),
  ];
};

const run = (): void => {
  const errors = validateDocumentation({ rootDirectory: process.cwd() });
  if (errors.length === 0) {
    process.stdout.write(
      `Documentação válida: ${CANONICAL_DOCUMENT_PATHS.length} documentos canônicos.\n`
    );
    return;
  }

  process.stderr.write(
    `Falha na documentação (${errors.length}):\n${errors
      .map((error) => `- ${error}`)
      .join("\n")}\n`
  );
  process.exitCode = 1;
};

if (import.meta.main && extname(import.meta.filename) === ".ts") {
  run();
}
