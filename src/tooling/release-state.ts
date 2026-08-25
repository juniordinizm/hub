export type ReleaseEnvironment = "development" | "production" | "staging";

export interface ReleaseCheckpoint {
  commit: string;
  environment: ReleaseEnvironment;
}

export interface ReleaseCheckpointInput {
  commit: string;
  environment: string;
}

export interface ReleaseStateInput {
  deployed: ReleaseCheckpointInput;
  documented: ReleaseCheckpointInput;
  verified: ReleaseCheckpointInput;
}

export interface ReleaseState {
  deployed: ReleaseCheckpoint;
  documented: ReleaseCheckpoint;
  verified: ReleaseCheckpoint;
}

const RELEASE_ENVIRONMENTS = new Set<ReleaseEnvironment>([
  "development",
  "production",
  "staging",
]);
const FULL_GIT_SHA = /^[0-9a-f]{40}$/i;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const LINE_BREAK = /\r?\n/;

const isReleaseEnvironment = (value: string): value is ReleaseEnvironment =>
  RELEASE_ENVIRONMENTS.has(value as ReleaseEnvironment);

const assertCheckpoint = (
  name: keyof ReleaseStateInput,
  checkpoint: ReleaseCheckpointInput
): ReleaseCheckpoint => {
  const commit = checkpoint.commit.trim();
  if (!FULL_GIT_SHA.test(commit)) {
    throw new Error(`${name}.commit must be a full Git SHA.`);
  }

  if (!isReleaseEnvironment(checkpoint.environment)) {
    throw new Error(`${name}.environment is required.`);
  }

  return {
    commit,
    environment: checkpoint.environment,
  };
};

export const parseReleaseState = (input: ReleaseStateInput): ReleaseState => ({
  deployed: assertCheckpoint("deployed", input.deployed),
  documented: assertCheckpoint("documented", input.documented),
  verified: assertCheckpoint("verified", input.verified),
});

export const parseReleaseStateDocument = (content: string): ReleaseState => {
  const block = content.match(FRONTMATTER)?.[1];
  if (!block) {
    throw new Error("release-state frontmatter is required.");
  }
  const metadata = new Map<string, string>();
  for (const line of block.split(LINE_BREAK)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }
    metadata.set(
      line.slice(0, separatorIndex).trim(),
      line.slice(separatorIndex + 1).trim()
    );
  }

  return parseReleaseState({
    deployed: {
      commit: metadata.get("deployed_commit") ?? "",
      environment: metadata.get("deployed_environment") ?? "",
    },
    documented: {
      commit: metadata.get("documented_commit") ?? "",
      environment: metadata.get("documented_environment") ?? "",
    },
    verified: {
      commit: metadata.get("verified_commit") ?? "",
      environment: metadata.get("verified_environment") ?? "",
    },
  });
};
