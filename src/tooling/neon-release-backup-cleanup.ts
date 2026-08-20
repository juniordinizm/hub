export const RELEASE_BACKUP_PREFIXES = {
  production: "production-release-",
  staging: "staging-release-",
} as const;

export type ReleaseBackupEnvironment = keyof typeof RELEASE_BACKUP_PREFIXES;

export const RELEASE_BACKUP_CLEANUP_CONFIRMATION = "cleanup-release-backups";
export const MAX_RELEASE_BACKUPS_PER_RUN = 2;

const MAX_BRANCH_LIST_PAGES = 100;
const NEON_API_HOST = "https://console.neon.tech/api/v2";

export interface NeonReleaseBranch {
  created_at?: string | null;
  current_state?: string | null;
  default?: boolean;
  expires_at?: string | null;
  id: string;
  name: string;
  parent_id?: string | null;
  primary?: boolean;
  project_id: string;
  protected?: boolean;
}

export interface SelectReleaseBackupOptions {
  environment: ReleaseBackupEnvironment;
  parentBranchId: string;
  projectId: string;
}

export interface ReleaseBackupSelection {
  candidates: NeonReleaseBranch[];
  latest: NeonReleaseBranch | null;
}

export interface ReleaseBackupCleanupResult {
  deleted: string[];
  environment: ReleaseBackupEnvironment;
  preserved: string[];
  wouldDelete: string[];
}

type CleanupEnvironment = Readonly<Record<string, string | undefined>>;
type FetchLike = typeof fetch;

const parseDate = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const isReleaseBackupName = (
  name: string,
  environment: ReleaseBackupEnvironment
): boolean => name.startsWith(RELEASE_BACKUP_PREFIXES[environment]);

const compareNewestFirst = (
  left: NeonReleaseBranch,
  right: NeonReleaseBranch
): number => {
  const leftCreatedAt = parseDate(left.created_at) ?? Number.NEGATIVE_INFINITY;
  const rightCreatedAt =
    parseDate(right.created_at) ?? Number.NEGATIVE_INFINITY;

  return rightCreatedAt - leftCreatedAt || right.id.localeCompare(left.id);
};

export const selectSupersededReleaseBackups = (
  branches: readonly NeonReleaseBranch[],
  { environment, parentBranchId, projectId }: SelectReleaseBackupOptions
): ReleaseBackupSelection => {
  const matching = branches
    .filter((branch) => {
      if (
        branch.project_id !== projectId ||
        branch.parent_id !== parentBranchId ||
        !branch.id ||
        !isReleaseBackupName(branch.name, environment) ||
        branch.current_state !== "ready" ||
        branch.primary ||
        branch.default ||
        branch.protected
      ) {
        return false;
      }

      return true;
    })
    .sort(compareNewestFirst);

  return {
    candidates: matching.slice(1),
    latest: matching[0] ?? null,
  };
};

const requiredEnvironmentValue = (
  environment: CleanupEnvironment,
  name: string
): string => {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
};

const isSupportedArgument = (argument: string): boolean =>
  argument === "--dry-run" ||
  argument === "--execute" ||
  argument.startsWith("--environment=");

const parseArguments = (
  argv: readonly string[]
): { environment: ReleaseBackupEnvironment; mode: "dry-run" | "execute" } => {
  if (argv.some((argument) => !isSupportedArgument(argument))) {
    throw new Error(
      "Use --environment=staging|production with exactly one of --dry-run or --execute."
    );
  }

  const environmentArguments = argv.filter((argument) =>
    argument.startsWith("--environment=")
  );
  if (environmentArguments.length !== 1) {
    throw new Error("Choose exactly one --environment.");
  }

  const environmentArgument = environmentArguments[0];
  if (!environmentArgument) {
    throw new Error("--environment is required.");
  }
  const environmentValue = environmentArgument.slice("--environment=".length);
  if (environmentValue !== "staging" && environmentValue !== "production") {
    throw new Error("--environment must be staging or production.");
  }

  const modeArguments = argv.filter(
    (argument) => argument === "--dry-run" || argument === "--execute"
  );
  if (modeArguments.length !== 1) {
    throw new Error("Choose exactly one cleanup mode.");
  }

  const modeArgument = modeArguments[0];
  return {
    environment: environmentValue,
    mode: modeArgument === "--execute" ? "execute" : "dry-run",
  };
};

const readJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!response.ok) {
    let message = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text) as { message?: unknown };
      if (typeof parsed.message === "string") {
        message = parsed.message;
      }
    } catch {
      // Keep the bounded response text for diagnostics.
    }
    throw new Error(`Neon API returned HTTP ${response.status}: ${message}`);
  }

  return text ? JSON.parse(text) : null;
};

const listBranches = async (
  fetchImpl: FetchLike,
  projectId: string,
  apiKey: string
): Promise<NeonReleaseBranch[]> => {
  const branches: NeonReleaseBranch[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  for (let page = 0; page < MAX_BRANCH_LIST_PAGES; page += 1) {
    const params = new URLSearchParams({ limit: "100" });
    if (cursor) {
      params.set("cursor", cursor);
    }

    const response = await fetchImpl(
      `${NEON_API_HOST}/projects/${encodeURIComponent(projectId)}/branches?${params.toString()}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    const body = (await readJson(response)) as {
      branches?: unknown;
      pagination?: { next?: unknown } | null;
    } | null;

    if (!Array.isArray(body?.branches)) {
      throw new Error("Neon API returned an invalid branch list.");
    }

    branches.push(
      ...body.branches.filter(
        (branch): branch is NeonReleaseBranch =>
          typeof branch === "object" &&
          branch !== null &&
          typeof (branch as NeonReleaseBranch).id === "string" &&
          typeof (branch as NeonReleaseBranch).project_id === "string" &&
          typeof (branch as NeonReleaseBranch).name === "string"
      )
    );

    const nextCursor =
      typeof body.pagination?.next === "string" &&
      body.pagination.next.length > 0
        ? body.pagination.next
        : null;
    if (!nextCursor) {
      return branches;
    }
    if (seenCursors.has(nextCursor)) {
      throw new Error("Neon API returned a repeated branch cursor.");
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  throw new Error("Neon API branch pagination exceeded the safety limit.");
};

const deleteBranch = async (
  fetchImpl: FetchLike,
  projectId: string,
  branchId: string,
  apiKey: string
): Promise<void> => {
  const response = await fetchImpl(
    `${NEON_API_HOST}/projects/${encodeURIComponent(projectId)}/branches/${encodeURIComponent(branchId)}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      method: "DELETE",
    }
  );
  await readJson(response);
};

export const runReleaseBackupCleanup = async ({
  argv,
  environment,
  fetchImpl = fetch,
  writeOutput = (value: string) => process.stdout.write(`${value}\n`),
}: {
  argv: readonly string[];
  environment: CleanupEnvironment;
  fetchImpl?: FetchLike;
  writeOutput?: (value: string) => void;
}): Promise<ReleaseBackupCleanupResult> => {
  const { environment: targetEnvironment, mode } = parseArguments(argv);
  const apiKey = requiredEnvironmentValue(environment, "NEON_API_KEY");
  const projectId = requiredEnvironmentValue(
    environment,
    "NEON_RELEASE_PROJECT_ID"
  );
  const parentBranchId = requiredEnvironmentValue(
    environment,
    "NEON_RELEASE_PARENT_BRANCH_ID"
  );

  if (
    mode === "execute" &&
    environment.RELEASE_BACKUP_CLEANUP_CONFIRMATION !==
      RELEASE_BACKUP_CLEANUP_CONFIRMATION
  ) {
    throw new Error(
      "RELEASE_BACKUP_CLEANUP_CONFIRMATION must equal cleanup-release-backups for --execute."
    );
  }

  const branches = await listBranches(fetchImpl, projectId, apiKey);
  const selection = selectSupersededReleaseBackups(branches, {
    environment: targetEnvironment,
    parentBranchId,
    projectId,
  });

  if (selection.candidates.length > MAX_RELEASE_BACKUPS_PER_RUN) {
    throw new Error(
      `Refusing to delete more than ${MAX_RELEASE_BACKUPS_PER_RUN} release backups in one run.`
    );
  }

  const preserved = selection.latest ? [selection.latest.id] : [];
  const wouldDelete = selection.candidates.map(({ id }) => id);

  if (mode === "dry-run") {
    writeOutput(
      JSON.stringify({
        environment: targetEnvironment,
        mode,
        preserved,
        wouldDelete: selection.candidates.map(({ id, name }) => ({ id, name })),
      })
    );
    return {
      deleted: [],
      environment: targetEnvironment,
      preserved,
      wouldDelete,
    };
  }

  const deleted: string[] = [];
  for (const candidate of selection.candidates) {
    await deleteBranch(fetchImpl, projectId, candidate.id, apiKey);
    deleted.push(candidate.id);
  }

  writeOutput(
    JSON.stringify({
      deleted,
      environment: targetEnvironment,
      mode,
      preserved,
    })
  );
  return {
    deleted,
    environment: targetEnvironment,
    preserved,
    wouldDelete: [],
  };
};

const main = async (): Promise<void> => {
  await runReleaseBackupCleanup({
    argv: process.argv.slice(2),
    environment: process.env,
  });
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Release backup cleanup failed."}\n`
    );
    process.exitCode = 1;
  }
}
