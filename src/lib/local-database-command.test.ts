import { describe, expect, it } from "vitest";
import {
  assertSafeLocalDatabaseCommand,
  parseLocalResetArguments,
} from "./local-database-command";

describe("assertSafeLocalDatabaseCommand", () => {
  const localDatabaseUrl = "postgresql://user:secret@127.0.0.1:5432/hub_test";

  it("rejects destructive commands without the explicit flag", () => {
    expect(() =>
      assertSafeLocalDatabaseCommand({
        confirmation: "hub_test",
        databaseUrl: localDatabaseUrl,
        environment: "test",
        operation: "reset",
      })
    ).toThrow(
      "Use --allow-destructive-local-reset para executar o reset local."
    );
  });

  it("rejects a production environment even for a localhost URL", () => {
    expect(() =>
      assertSafeLocalDatabaseCommand({
        allowDestructiveLocalReset: true,
        confirmation: "hub_test",
        databaseUrl: localDatabaseUrl,
        environment: "production",
        operation: "reset",
      })
    ).toThrow("O comando reset so pode ser executado em development ou test.");
  });

  it("rejects a non-local database without exposing its URL", () => {
    expect(() =>
      assertSafeLocalDatabaseCommand({
        allowDestructiveLocalReset: true,
        confirmation: "hub_production",
        databaseUrl:
          "postgresql://user:secret@ep-cool-river.neon.tech/hub_production",
        environment: "test",
        operation: "reset",
      })
    ).toThrow("O comando reset exige host de banco local.");
  });

  it("rejects a confirmation that does not name the target database", () => {
    expect(() =>
      assertSafeLocalDatabaseCommand({
        allowDestructiveLocalReset: true,
        confirmation: "confirmar",
        databaseUrl: localDatabaseUrl,
        environment: "test",
        operation: "reset",
      })
    ).toThrow('Confirme digitando o nome do banco alvo: "hub_test".');
  });

  it("rejects a reset database that is not explicitly allowlisted", () => {
    expect(() =>
      assertSafeLocalDatabaseCommand({
        allowDestructiveLocalReset: true,
        allowedDatabaseNames: ["hub_local"],
        confirmation: "hub_test",
        databaseUrl: localDatabaseUrl,
        environment: "test",
        operation: "reset",
      })
    ).toThrow("O banco alvo nao esta na allowlist LOCAL_DATABASE_NAMES.");
  });

  it("accepts an explicit reset of a local test database", () => {
    expect(() =>
      assertSafeLocalDatabaseCommand({
        allowDestructiveLocalReset: true,
        allowedDatabaseNames: ["hub_test"],
        confirmation: "hub_test",
        databaseUrl: localDatabaseUrl,
        environment: "test",
        operation: "reset",
      })
    ).not.toThrow();
  });

  it("allows seeds only against a local development or test database", () => {
    expect(() =>
      assertSafeLocalDatabaseCommand({
        databaseUrl: localDatabaseUrl,
        environment: "development",
        operation: "seed",
      })
    ).not.toThrow();
  });
});

describe("parseLocalResetArguments", () => {
  it("reads the destructive flag and target confirmation", () => {
    expect(
      parseLocalResetArguments([
        "--allow-destructive-local-reset",
        "--confirm=hub_test",
      ])
    ).toEqual({
      allowDestructiveLocalReset: true,
      confirmation: "hub_test",
    });
  });

  it("does not treat an unrelated argument as confirmation", () => {
    expect(parseLocalResetArguments(["--confirm", "hub_test"])).toEqual({
      allowDestructiveLocalReset: false,
      confirmation: undefined,
    });
  });
});
