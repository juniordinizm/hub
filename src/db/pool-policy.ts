export type DatabasePoolPurpose = "application" | "readiness";

interface DatabasePoolOptions {
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
  max: number;
}

const APPLICATION_POOL_OPTIONS = {
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  max: 10,
} as const satisfies DatabasePoolOptions;

const READINESS_POOL_OPTIONS = {
  connectionTimeoutMillis: 1000,
  idleTimeoutMillis: 10_000,
  max: 1,
} as const satisfies DatabasePoolOptions;

export const getDatabasePoolOptions = (
  purpose: DatabasePoolPurpose
): DatabasePoolOptions =>
  purpose === "readiness" ? READINESS_POOL_OPTIONS : APPLICATION_POOL_OPTIONS;
