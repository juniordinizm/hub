import { createHash } from "node:crypto";

export const PRODUCTION_CLEANUP_TABLES = [
  "accounts",
  "app_settings",
  "audit_logs",
  "certificate_issuer_profiles",
  "certificate_template_asset_cleanup",
  "certificate_templates",
  "certificates",
  "course_completions",
  "course_publications",
  "courses",
  "dashboard_banners",
  "enrollment_events",
  "enrollment_expiration_adjustments",
  "enrollment_grants",
  "enrollments",
  "faq_items",
  "jmvstream_folders",
  "jmvstream_video_assets",
  "learning_analytics_daily_metrics",
  "learning_analytics_events",
  "learning_analytics_preferences",
  "lesson_comments",
  "lesson_progress",
  "lesson_watch_progress",
  "lessons",
  "modules",
  "orders",
  "outbox_messages",
  "payment_reviews",
  "profiles",
  "public_certificate_rate_limits",
  "refund_requests",
  "scheduled_job_leases",
  "sessions",
  "staged_admin_image_uploads",
  "users",
  "verifications",
  "webhook_events",
] as const;

export const PRESERVED_IDENTITY_TABLES = [
  "accounts",
  "profiles",
  "sessions",
  "users",
] as const;

const preservedIdentityTableSet = new Set<string>(PRESERVED_IDENTITY_TABLES);

export const TRUNCATED_OPERATIONAL_TABLES = PRODUCTION_CLEANUP_TABLES.filter(
  (table) => !preservedIdentityTableSet.has(table)
);

const EXECUTE_CONFIRMATION = "DELETE_TEST_DATA_EXCEPT_CURRENT_ADMIN";
const ARGUMENT_PATTERN = /^--([a-z-]+)=(.*)$/;
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;
const POOLED_HOST_MARKER = "-pooler.";
const EXPECTED_JOURNAL_COUNT = 44;

export interface AdminCandidate {
  blocked: boolean;
  credentialCount: number;
  id: string;
}

export interface MigrationJournalRow {
  createdAt: string;
  hash: string;
}

export interface CleanupSnapshot {
  adminCount: number;
  adminIdHash: string;
  branchId: string;
  database: string;
  host: string;
  journalCount: number;
  journalHash: string;
  journalTop: "0043";
  publicTables: string[];
  rowCounts: Record<string, number>;
}

export type CleanupArguments =
  | {
      environment: "production";
      mode: "plan";
    }
  | {
      confirmation: typeof EXECUTE_CONFIRMATION;
      confirmCleanup: true;
      environment: "production";
      fingerprint: string;
      mode: "execute";
    };

const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, nestedValue) => {
    if (
      !(
        nestedValue &&
        typeof nestedValue === "object" &&
        !Array.isArray(nestedValue)
      )
    ) {
      return nestedValue;
    }

    return Object.fromEntries(
      Object.entries(nestedValue).sort(([left], [right]) =>
        left.localeCompare(right)
      )
    );
  });

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const readArgumentMap = (
  arguments_: readonly string[]
): ReadonlyMap<string, string> => {
  const allowedKeys = new Set([
    "confirm-cleanup",
    "confirmation",
    "environment",
    "fingerprint",
    "mode",
  ]);
  const values = new Map<string, string>();

  for (const argument of arguments_) {
    const match = ARGUMENT_PATTERN.exec(argument);
    if (!match) {
      throw new Error("Unknown cleanup argument.");
    }
    const [, key, value] = match;
    if (!(key && value !== undefined && allowedKeys.has(key))) {
      throw new Error("Unknown cleanup argument.");
    }
    if (values.has(key)) {
      throw new Error("Duplicate cleanup argument.");
    }
    values.set(key, value);
  }

  return values;
};

export const parseCleanupArguments = (
  arguments_: readonly string[]
): CleanupArguments => {
  const values = readArgumentMap(arguments_);
  if (values.get("environment") !== "production") {
    throw new Error("Cleanup environment must equal production.");
  }

  const mode = values.get("mode");
  if (mode === "plan") {
    if (
      values.has("confirm-cleanup") ||
      values.has("confirmation") ||
      values.has("fingerprint")
    ) {
      throw new Error("Plan mode does not accept destructive arguments.");
    }
    return { environment: "production", mode };
  }

  if (mode !== "execute") {
    throw new Error("Cleanup mode must equal plan or execute.");
  }

  if (
    values.get("confirm-cleanup") !== "true" ||
    values.get("confirmation") !== EXECUTE_CONFIRMATION
  ) {
    throw new Error("Destructive cleanup confirmation is invalid.");
  }

  const fingerprint = values.get("fingerprint");
  if (!(fingerprint && FINGERPRINT_PATTERN.test(fingerprint))) {
    throw new Error("Cleanup fingerprint is invalid.");
  }

  return {
    confirmation: EXECUTE_CONFIRMATION,
    confirmCleanup: true,
    environment: "production",
    fingerprint,
    mode,
  };
};

export const normalizeNeonHost = (host: string): string =>
  host.trim().toLowerCase().replace(POOLED_HOST_MARKER, ".");

export const getPublicTableProblems = (
  publicTables: readonly string[]
): string[] => {
  const actual = new Set(publicTables);
  const expected = new Set<string>(PRODUCTION_CLEANUP_TABLES);
  const problems: string[] = [];

  for (const table of PRODUCTION_CLEANUP_TABLES) {
    if (!actual.has(table)) {
      problems.push(`missing table: ${table}`);
    }
  }
  for (const table of [...actual].sort()) {
    if (!expected.has(table)) {
      problems.push(`unexpected table: ${table}`);
    }
  }

  return problems;
};

export const getAdminCandidateProblems = (
  candidates: readonly AdminCandidate[]
): string[] => {
  if (candidates.length !== 1) {
    return ["exactly one Admin is required"];
  }

  const [candidate] = candidates;
  if (!candidate) {
    return ["exactly one Admin is required"];
  }

  const problems: string[] = [];
  if (candidate.blocked) {
    problems.push("Admin must not be blocked");
  }
  if (candidate.credentialCount < 1) {
    problems.push("Admin password credential is required");
  }
  return problems;
};

export const getJournalProblems = (
  actual: readonly MigrationJournalRow[],
  expected: readonly MigrationJournalRow[]
): string[] => {
  if (
    expected.length !== EXPECTED_JOURNAL_COUNT ||
    actual.length !== EXPECTED_JOURNAL_COUNT
  ) {
    return ["migration journal must contain exactly 44 expected entries"];
  }

  const matches = actual.every(
    (row, index) =>
      row.createdAt === expected[index]?.createdAt &&
      row.hash === expected[index]?.hash
  );
  return matches ? [] : ["migration journal does not match 0043"];
};

const getRowCountProblems = (
  rowCounts: Readonly<Record<string, number>>
): string[] => {
  const problems = getPublicTableProblems(Object.keys(rowCounts));
  if (
    Object.values(rowCounts).some(
      (count) => !Number.isSafeInteger(count) || count < 0
    )
  ) {
    problems.push("row counts must be non-negative safe integers");
  }
  return problems;
};

export const buildCleanupSnapshot = ({
  adminCandidates,
  branchId,
  database,
  expectedJournal,
  host,
  journal,
  publicTables,
  rowCounts,
}: {
  adminCandidates: readonly AdminCandidate[];
  branchId: string;
  database: string;
  expectedJournal: readonly MigrationJournalRow[];
  host: string;
  journal: readonly MigrationJournalRow[];
  publicTables: readonly string[];
  rowCounts: Readonly<Record<string, number>>;
}): CleanupSnapshot => {
  const problems = [
    ...getPublicTableProblems(publicTables),
    ...getAdminCandidateProblems(adminCandidates),
    ...getJournalProblems(journal, expectedJournal),
    ...getRowCountProblems(rowCounts),
  ];
  if (problems.length > 0) {
    throw new Error(
      `Production cleanup precondition failed: ${problems.join(", ")}.`
    );
  }

  const admin = adminCandidates[0];
  if (!admin) {
    throw new Error("Production cleanup precondition failed.");
  }

  return {
    adminCount: 1,
    adminIdHash: sha256(`protea-r-admin:${admin.id}`),
    branchId: branchId.trim(),
    database: database.trim(),
    host: normalizeNeonHost(host),
    journalCount: journal.length,
    journalHash: sha256(canonicalJson(journal)),
    journalTop: "0043",
    publicTables: [...publicTables].sort(),
    rowCounts: Object.fromEntries(
      Object.entries(rowCounts).sort(([left], [right]) =>
        left.localeCompare(right)
      )
    ),
  };
};

export const createCleanupFingerprint = (snapshot: CleanupSnapshot): string =>
  sha256(canonicalJson(snapshot));
