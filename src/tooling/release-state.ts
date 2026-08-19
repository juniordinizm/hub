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

const isReleaseEnvironment = (value: string): value is ReleaseEnvironment =>
  RELEASE_ENVIRONMENTS.has(value as ReleaseEnvironment);

const assertCheckpoint = (
  name: keyof ReleaseStateInput,
  checkpoint: ReleaseCheckpointInput
): ReleaseCheckpoint => {
  if (!checkpoint.commit.trim()) {
    throw new Error(`${name}.commit is required.`);
  }

  if (!isReleaseEnvironment(checkpoint.environment)) {
    throw new Error(`${name}.environment is required.`);
  }

  return {
    commit: checkpoint.commit.trim(),
    environment: checkpoint.environment,
  };
};

export const parseReleaseState = (input: ReleaseStateInput): ReleaseState => ({
  deployed: assertCheckpoint("deployed", input.deployed),
  documented: assertCheckpoint("documented", input.documented),
  verified: assertCheckpoint("verified", input.verified),
});
