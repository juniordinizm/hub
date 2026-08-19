export const CI_NEON_BRANCH_PREFIXES = ["ci-integration-", "ci-e2e-"] as const;

export const DEFAULT_STALE_AFTER_MS = 26 * 60 * 60 * 1000;
const CLEANUP_CONFIRMATION = "cleanup-ci-neon";
const MAX_BRANCHES_PER_RUN = 50;
const MAX_BRANCH_LIST_PAGES = 100;
const NEON_API_HOST = "https://console.neon.tech/api/v2";

export interface NeonCiBranch {
  created_at?: string | null;
  current_state?: string | null;
  default?: boolean;
  expires_at?: string | null;
  id: string;
  name: string;
  primary?: boolean;
  project_id: string;
  protected?: boolean;
}

export interface SelectStaleCiBranchesOptions {
  now?: Date;
  projectId: string;
  staleAfterMs?: number;
}

export interface CiNeonCleanupResult {
  deleted: string[];
  wouldDelete: string[];
}

type CleanupEnvironment = Readonly<Record<string, string | undefined>>;
type FetchLike = typeof fetch;

const isCiBranchName = (name: string): boolean =>
  CI_NEON_BRANCH_PREFIXES.some((prefix) => name.startsWith(prefix));

const parseDate = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

export const selectStaleCiBranches = (
  branches: readonly NeonCiBranch[],
  {
    now = new Date(),
    projectId,
    staleAfterMs = DEFAULT_STALE_AFTER_MS,
  }: SelectStaleCiBranchesOptions
): NeonCiBranch[] => {
  const nowTimestamp = now.getTime();
  const candidates = branches.filter((branch) => {
    if (
      branch.project_id !== projectId ||
      !branch.id ||
      !isCiBranchName(branch.name) ||
      branch.primary ||
      branch.default ||
      branch.protected
    ) {
      return false;
    }

    const expiresAt = parseDate(branch.expires_at);
    if (expiresAt !== null) {
      return expiresAt <= nowTimestamp;
    }

    const createdAt = parseDate(branch.created_at);
    return createdAt !== null && createdAt + staleAfterMs <= nowTimestamp;
  });

  return candidates.sort((left, right) => {
    const leftCreatedAt =
      parseDate(left.created_at) ?? Number.POSITIVE_INFINITY;
    const rightCreatedAt =
      parseDate(right.created_at) ?? Number.POSITIVE_INFINITY;
    return leftCreatedAt - rightCreatedAt || left.id.localeCompare(right.id);
  });
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

const parseMode = (argv: readonly string[]): "dry-run" | "execute" => {
  const modes = argv.filter((argument) =>
    ["--dry-run", "--execute"].includes(argument)
  );
  if (argv.some((argument) => !["--dry-run", "--execute"].includes(argument))) {
    throw new Error("Use only --dry-run or --execute.");
  }
  if (modes.length !== 1) {
    throw new Error("Choose exactly one cleanup mode.");
  }
  return modes[0] === "--execute" ? "execute" : "dry-run";
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
): Promise<NeonCiBranch[]> => {
  const branches: NeonCiBranch[] = [];
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
        (branch): branch is NeonCiBranch =>
          typeof branch === "object" &&
          branch !== null &&
          typeof (branch as NeonCiBranch).id === "string" &&
          typeof (branch as NeonCiBranch).project_id === "string" &&
          typeof (branch as NeonCiBranch).name === "string"
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

export const runCiNeonBranchCleanup = async ({
  argv,
  environment,
  fetchImpl = fetch,
  now = new Date(),
  writeOutput = (value: string) => process.stdout.write(`${value}\n`),
}: {
  argv: readonly string[];
  environment: CleanupEnvironment;
  fetchImpl?: FetchLike;
  now?: Date;
  writeOutput?: (value: string) => void;
}): Promise<CiNeonCleanupResult> => {
  const mode = parseMode(argv);
  const apiKey = requiredEnvironmentValue(environment, "NEON_API_KEY");
  const projectId = requiredEnvironmentValue(environment, "NEON_CI_PROJECT_ID");
  if (
    mode === "execute" &&
    environment.CI_NEON_CLEANUP_CONFIRMATION !== CLEANUP_CONFIRMATION
  ) {
    throw new Error(
      "CI_NEON_CLEANUP_CONFIRMATION must equal cleanup-ci-neon for --execute."
    );
  }

  const staleAfterHours = Number(environment.CI_NEON_BRANCH_STALE_AFTER_HOURS);
  const staleAfterMs =
    Number.isFinite(staleAfterHours) && staleAfterHours > 0
      ? staleAfterHours * 60 * 60 * 1000
      : DEFAULT_STALE_AFTER_MS;
  const branches = await listBranches(fetchImpl, projectId, apiKey);
  const candidates = selectStaleCiBranches(branches, {
    now,
    projectId,
    staleAfterMs,
  });
  if (candidates.length > MAX_BRANCHES_PER_RUN) {
    throw new Error(
      `Refusing to delete more than ${MAX_BRANCHES_PER_RUN} CI branches in one run.`
    );
  }

  if (mode === "dry-run") {
    writeOutput(
      JSON.stringify({
        mode,
        wouldDelete: candidates.map(({ id, name }) => ({ id, name })),
      })
    );
    return { deleted: [], wouldDelete: candidates.map(({ id }) => id) };
  }

  const deleted: string[] = [];
  for (const candidate of candidates) {
    await deleteBranch(fetchImpl, projectId, candidate.id, apiKey);
    deleted.push(candidate.id);
  }
  writeOutput(JSON.stringify({ deleted, mode }));
  return { deleted, wouldDelete: [] };
};

const main = async (): Promise<void> => {
  const result = await runCiNeonBranchCleanup({
    argv: process.argv.slice(2),
    environment: process.env,
  });
  if (result.deleted.length > 0) {
    process.stdout.write(
      `Deleted ${result.deleted.length} CI Neon branch(es).\n`
    );
  }
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "CI Neon cleanup failed."}\n`
    );
    process.exitCode = 1;
  }
}
