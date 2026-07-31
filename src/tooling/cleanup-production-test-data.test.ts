import { resolve } from "node:path";
import type { PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";
import {
  readExpectedProductionCleanupJournal,
  runProductionCleanupCli,
} from "../../scripts/cleanup-production-test-data";

const SHA_256_PATTERN = /^[0-9a-f]{64}$/;
const migrationsFolder = resolve(process.cwd(), "src/db/migrations");

const completeEnvironment = {
  DATABASE_URL_DIRECT:
    "postgresql://private-user:private-password@ep-production-pooler.example/neondb?sslmode=require",
  PRODUCTION_DATABASE_HOST: "ep-production.example",
  PRODUCTION_NEON_BRANCH_ID: "br-production",
};

const createRuntime = () => {
  const release = vi.fn();
  const end = vi.fn(async () => undefined);
  const client = { release } as unknown as PoolClient;
  const connect = vi.fn(async () => client);
  const createPool = vi.fn(() => ({ connect, end }));
  const executeCleanup = vi.fn(async () => ({
    fingerprint: "a".repeat(64),
    mode: "plan" as const,
    rowCounts: { orders: 5, users: 2 },
    status: "planned" as const,
  }));
  const output: string[] = [];

  return {
    client,
    connect,
    createPool,
    end,
    executeCleanup,
    output,
    release,
    writeOutput: (value: string): void => {
      output.push(value);
    },
  };
};

describe("production cleanup CLI", () => {
  it.each([
    ["DATABASE_URL_DIRECT"],
    ["PRODUCTION_DATABASE_HOST"],
    ["PRODUCTION_NEON_BRANCH_ID"],
  ] as const)("rejects missing %s before creating a pool", async (missing) => {
    const runtime = createRuntime();
    const environment = { ...completeEnvironment };
    delete environment[missing];

    await expect(
      runProductionCleanupCli({
        argv: ["--mode=plan", "--environment=production"],
        createPool: runtime.createPool,
        environment,
        executeCleanup: runtime.executeCleanup,
        migrationsFolder,
        writeOutput: runtime.writeOutput,
      })
    ).rejects.toThrow(`${missing} is required.`);
    expect(runtime.createPool).not.toHaveBeenCalled();
  });

  it("loads exactly the local journal through 0043", () => {
    const journal = readExpectedProductionCleanupJournal(migrationsFolder);

    expect(journal).toHaveLength(44);
    expect(journal[0]?.hash).toBe(
      "aa9f7dbeba9104c1f4ab53c816505dda5498f217fc4bd6d93a16a9bab4a096b4"
    );
    expect(journal[9]?.hash).toBe(
      "6eb810a886848de15920cb70399433bcff2b6c7756f13c2ff8930b66e7309600"
    );
    expect(journal.slice(37, 40).map(({ hash }) => hash)).toEqual([
      "eb34cd09c5f37f74b66be564efaa7ec87057ca412d2b397921b6c07944d9ad08",
      "c86ee2d86297d032acac48323cb4275659fa94225dba165b83e9e2dc4a000b6d",
      "c86ee2d86297d032acac48323cb4275659fa94225dba165b83e9e2dc4a000b6d",
    ]);
    expect(journal[43]).toMatchObject({
      createdAt: "1785037403006",
      hash: "37737b7c82d6973581fd1ff5534a3e797980b7e55d9ca6a260f950111c5cf68b",
    });
    expect(journal.every((row) => SHA_256_PATTERN.test(row.hash))).toBe(true);
  });

  it("runs plan with a sanitized one-line result and closes resources", async () => {
    const runtime = createRuntime();

    await runProductionCleanupCli({
      argv: ["--mode=plan", "--environment=production"],
      createPool: runtime.createPool,
      environment: completeEnvironment,
      executeCleanup: runtime.executeCleanup,
      migrationsFolder,
      writeOutput: runtime.writeOutput,
    });

    expect(runtime.executeCleanup).toHaveBeenCalledWith(
      expect.objectContaining({
        dependencies: {
          expectedJournal: expect.arrayContaining([
            expect.objectContaining({
              createdAt: "1785037403006",
            }),
          ]),
        },
        input: {
          branchId: "br-production",
          database: "neondb",
          expectedHost: "ep-production.example",
          host: "ep-production-pooler.example",
          mode: "plan",
        },
      })
    );
    expect(runtime.release).toHaveBeenCalledOnce();
    expect(runtime.end).toHaveBeenCalledOnce();
    expect(runtime.output).toHaveLength(1);
    expect(runtime.output[0]?.trim()).toBe(
      JSON.stringify({
        fingerprint: "a".repeat(64),
        mode: "plan",
        rowCounts: { orders: 5, users: 2 },
        status: "planned",
      })
    );
    expect(runtime.output.join("")).not.toContain("private-password");
    expect(runtime.output.join("")).not.toContain("private-user");
  });

  it("passes the approved fingerprint only in execute mode", async () => {
    const runtime = createRuntime();
    const fingerprint = "b".repeat(64);

    await runProductionCleanupCli({
      argv: [
        "--mode=execute",
        "--environment=production",
        `--fingerprint=${fingerprint}`,
        "--confirm-cleanup=true",
        "--confirmation=DELETE_TEST_DATA_EXCEPT_CURRENT_ADMIN",
      ],
      createPool: runtime.createPool,
      environment: completeEnvironment,
      executeCleanup: runtime.executeCleanup,
      migrationsFolder,
      writeOutput: runtime.writeOutput,
    });

    expect(runtime.executeCleanup).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          expectedFingerprint: fingerprint,
          mode: "execute",
        }),
      })
    );
  });
});
