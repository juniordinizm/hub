const SMOKE_DATABASE_PREFIX = "hub_smoke_";
const SAFE_DATABASE_NAME = /^[a-z0-9_]+$/;

export const createSmokeDatabaseName = (timestamp: number): string =>
  `${SMOKE_DATABASE_PREFIX}${timestamp}`;

export const replaceDatabaseName = (
  databaseUrl: string,
  databaseName: string
): string => {
  if (!SAFE_DATABASE_NAME.test(databaseName)) {
    throw new Error("O nome do banco de smoke e invalido.");
  }

  const url = new URL(databaseUrl);
  url.pathname = `/${databaseName}`;

  return url.toString();
};
