const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
const LEADING_SLASHES = /^\/+/;

type DatabaseCommandOperation = "reset" | "seed";

export interface SafeLocalDatabaseCommandInput {
  allowDestructiveLocalReset?: boolean;
  allowedDatabaseNames?: string[];
  confirmation?: string | undefined;
  databaseUrl: string;
  environment: string | undefined;
  operation: DatabaseCommandOperation;
}

export interface SafeLocalDatabaseTarget {
  databaseName: string;
  host: string;
}

export interface LocalResetArguments {
  allowDestructiveLocalReset: boolean;
  confirmation: string | undefined;
}

export const parseLocalResetArguments = (
  argumentsList: string[]
): LocalResetArguments => {
  const confirmationArgument = argumentsList.find((argument) =>
    argument.startsWith("--confirm=")
  );

  return {
    allowDestructiveLocalReset: argumentsList.includes(
      "--allow-destructive-local-reset"
    ),
    confirmation: confirmationArgument?.slice("--confirm=".length),
  };
};

const readDatabaseTarget = (databaseUrl: string): SafeLocalDatabaseTarget => {
  let url: URL;

  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("A URL do banco local e invalida.");
  }

  const databaseName = decodeURIComponent(url.pathname).replace(
    LEADING_SLASHES,
    ""
  );

  if (!databaseName) {
    throw new Error("A URL do banco local nao informa o nome do banco.");
  }

  return { databaseName, host: url.hostname };
};

export const assertSafeLocalDatabaseCommand = ({
  allowDestructiveLocalReset = false,
  allowedDatabaseNames = [],
  confirmation,
  databaseUrl,
  environment,
  operation,
}: SafeLocalDatabaseCommandInput): SafeLocalDatabaseTarget => {
  if (environment !== "development" && environment !== "test") {
    throw new Error(
      `O comando ${operation} so pode ser executado em development ou test.`
    );
  }

  const target = readDatabaseTarget(databaseUrl);

  if (!LOCAL_DATABASE_HOSTS.has(target.host)) {
    throw new Error(`O comando ${operation} exige host de banco local.`);
  }

  if (operation === "reset") {
    if (!allowDestructiveLocalReset) {
      throw new Error(
        "Use --allow-destructive-local-reset para executar o reset local."
      );
    }

    if (confirmation?.trim() !== target.databaseName) {
      throw new Error(
        `Confirme digitando o nome do banco alvo: "${target.databaseName}".`
      );
    }

    if (!allowedDatabaseNames.includes(target.databaseName)) {
      throw new Error(
        "O banco alvo nao esta na allowlist LOCAL_DATABASE_NAMES."
      );
    }
  }

  return target;
};
