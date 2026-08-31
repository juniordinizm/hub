import { appendFileSync } from "node:fs";

const NEON_API_BASE_URL = "https://console.neon.tech/api/v2";
const MAXIMUM_READINESS_POLLS = 12;
const READINESS_POLL_INTERVAL_MS = 5000;
const RECOVERY_BRANCH_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;

type FetchImplementation = typeof fetch;
type SleepImplementation = (milliseconds: number) => Promise<void>;

export interface CreateNeonRecoveryBranchOptions {
  apiKey: string;
  branchName: string;
  expiresAt: string;
  fetchImpl?: FetchImplementation;
  now?: () => Date;
  parentBranchId: string;
  projectId: string;
  sleep?: SleepImplementation;
}

export interface NeonRecoveryBranchResult {
  branchId: string;
  branchName: string;
  expiresAt: string;
  parentBranchId: string;
  projectId: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const requiredOption = (value: string, name: string): string => {
  if (!value.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
};

const validateOptions = (
  options: CreateNeonRecoveryBranchOptions
): CreateNeonRecoveryBranchOptions => {
  const apiKey = requiredOption(options.apiKey, "apiKey");
  const projectId = requiredOption(options.projectId, "projectId");
  const parentBranchId = requiredOption(
    options.parentBranchId,
    "parentBranchId"
  );
  const branchName = requiredOption(options.branchName, "branchName");
  const expiresAt = requiredOption(options.expiresAt, "expiresAt");

  if (!RECOVERY_BRANCH_NAME_PATTERN.test(branchName)) {
    throw new Error(
      "branchName must contain only letters, numbers, dots, underscores and hyphens."
    );
  }

  const expiryTimestamp = Date.parse(expiresAt);
  if (Number.isNaN(expiryTimestamp)) {
    throw new Error("expiresAt must be a valid ISO date.");
  }
  const now = (options.now ?? (() => new Date()))().getTime();
  if (expiryTimestamp <= now) {
    throw new Error("expiresAt must be in the future.");
  }

  return {
    ...options,
    apiKey,
    branchName,
    expiresAt,
    parentBranchId,
    projectId,
  };
};

const readJson = async (
  response: Response,
  operation: string
): Promise<unknown> => {
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Neon API ${operation} failed with HTTP ${response.status}: ${body.slice(0, 300)}`
    );
  }
  if (!body) {
    return null;
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`Neon API ${operation} returned invalid JSON.`);
  }
};

const readBranch = (
  payload: unknown,
  expected: Pick<
    NeonRecoveryBranchResult,
    "branchName" | "expiresAt" | "parentBranchId" | "projectId"
  >
): { currentState: string; id: string } => {
  const branch =
    isRecord(payload) && isRecord(payload.branch) ? payload.branch : null;
  const id = typeof branch?.id === "string" ? branch.id : "";
  const name = typeof branch?.name === "string" ? branch.name : "";
  const projectId =
    typeof branch?.project_id === "string" ? branch.project_id : "";
  const parentBranchId =
    typeof branch?.parent_id === "string" ? branch.parent_id : "";
  const expiresAt =
    typeof branch?.expires_at === "string" ? branch.expires_at : "";
  const currentState =
    typeof branch?.current_state === "string" ? branch.current_state : "";

  if (!id || name !== expected.branchName) {
    throw new Error(
      "Neon API returned a recovery branch with an unexpected identity."
    );
  }
  if (projectId !== expected.projectId) {
    throw new Error(
      "Neon API returned a recovery branch in an unexpected project."
    );
  }
  if (parentBranchId !== expected.parentBranchId) {
    throw new Error(
      "Neon API returned a recovery branch whose parent branch does not match."
    );
  }
  if (!expiresAt || Date.parse(expiresAt) !== Date.parse(expected.expiresAt)) {
    throw new Error(
      "Neon API returned a recovery branch with an unexpected expiration."
    );
  }
  if (!currentState) {
    throw new Error("Neon API returned a recovery branch without a state.");
  }

  return { currentState, id };
};

const branchUrl = (projectId: string, branchId?: string): string =>
  `${NEON_API_BASE_URL}/projects/${encodeURIComponent(projectId)}/branches${
    branchId ? `/${encodeURIComponent(branchId)}` : ""
  }`;

export const createNeonRecoveryBranch = async (
  rawOptions: CreateNeonRecoveryBranchOptions
): Promise<NeonRecoveryBranchResult> => {
  const options = validateOptions(rawOptions);
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep =
    options.sleep ??
    ((milliseconds) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const expected = {
    branchName: options.branchName,
    expiresAt: options.expiresAt,
    parentBranchId: options.parentBranchId,
    projectId: options.projectId,
  } as const;

  const createResponse = await fetchImpl(branchUrl(options.projectId), {
    body: JSON.stringify({
      branch: {
        expires_at: options.expiresAt,
        name: options.branchName,
        parent_id: options.parentBranchId,
      },
    }),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const createdPayload = await readJson(createResponse, "branch creation");
  let branch = readBranch(createdPayload, expected);

  for (let attempt = 0; branch.currentState !== "ready"; attempt += 1) {
    if (branch.currentState === "failed") {
      throw new Error("Neon recovery branch entered the failed state.");
    }
    if (attempt >= MAXIMUM_READINESS_POLLS) {
      throw new Error(
        "Neon recovery branch did not become ready within the safety timeout."
      );
    }
    await sleep(READINESS_POLL_INTERVAL_MS);
    const statusResponse = await fetchImpl(
      branchUrl(options.projectId, branch.id),
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${options.apiKey}`,
        },
      }
    );
    branch = readBranch(
      await readJson(statusResponse, "branch readiness check"),
      expected
    );
  }

  return {
    branchId: branch.id,
    branchName: options.branchName,
    expiresAt: options.expiresAt,
    parentBranchId: options.parentBranchId,
    projectId: options.projectId,
  };
};

const readEnvironment = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
};

export const writeNeonRecoveryBranchOutputs = (
  result: NeonRecoveryBranchResult,
  outputPath: string
): void => {
  const output = [
    `branch_id=${result.branchId}`,
    `branch_name=${result.branchName}`,
    `expires_at=${result.expiresAt}`,
  ].join("\n");
  appendFileSync(outputPath, `${output}\n`, "utf8");
};

const main = async (): Promise<void> => {
  const result = await createNeonRecoveryBranch({
    apiKey: readEnvironment("NEON_API_KEY"),
    branchName: readEnvironment("NEON_BRANCH_NAME"),
    expiresAt: readEnvironment("NEON_EXPIRES_AT"),
    parentBranchId: readEnvironment("NEON_PARENT_BRANCH_ID"),
    projectId: readEnvironment("NEON_PROJECT_ID"),
  });
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    writeNeonRecoveryBranchOutputs(result, outputPath);
  }
  process.stdout.write(
    `${JSON.stringify({
      branchId: result.branchId,
      branchName: result.branchName,
      expiresAt: result.expiresAt,
      projectId: result.projectId,
    })}\n`
  );
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Neon recovery branch creation failed."}\n`
    );
    process.exitCode = 1;
  }
}
