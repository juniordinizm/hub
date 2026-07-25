import { describe, expect, it, vi } from "vitest";
import { LATEST_COMPATIBLE_MIGRATION_TIMESTAMP } from "@/db/migration-state";
import { checkDatabaseReadiness } from "./readiness";

describe("database readiness", () => {
  it("declara pronto somente depois de consultar o journal de migrations", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ ok: true }] });
    const release = vi.fn();
    const connect = vi.fn().mockResolvedValue({ query, release });

    await expect(checkDatabaseReadiness({ connect })).resolves.toEqual({
      ready: true,
    });
    expect(query).toHaveBeenCalledWith("begin read only");
    expect(query).toHaveBeenCalledWith(
      "select 1 from drizzle.__drizzle_migrations where created_at = $1 limit 1",
      [LATEST_COMPATIBLE_MIGRATION_TIMESTAMP]
    );
    expect(release).toHaveBeenCalledOnce();
  });

  it("não vaza a falha do banco na resposta de readiness", async () => {
    const query = vi.fn().mockRejectedValue(new Error("connection refused"));
    const release = vi.fn();

    await expect(
      checkDatabaseReadiness({
        connect: vi.fn().mockResolvedValue({ query, release }),
      })
    ).resolves.toEqual({ ready: false });
    expect(release).toHaveBeenCalledOnce();
  });

  it("declara indisponivel quando a migration compativel nao foi aplicada", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce(undefined);
    const release = vi.fn();

    await expect(
      checkDatabaseReadiness({
        connect: vi.fn().mockResolvedValue({ query, release }),
      })
    ).resolves.toEqual({ ready: false });
    expect(release).toHaveBeenCalledOnce();
  });
});
