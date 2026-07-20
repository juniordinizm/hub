import { describe, expect, it } from "vitest";
import {
  createSmokeDatabaseName,
  replaceDatabaseName,
} from "./empty-database-smoke";

describe("empty database smoke helpers", () => {
  it("creates a deterministic disposable database name", () => {
    expect(createSmokeDatabaseName(123)).toBe("hub_smoke_123");
  });

  it("preserves connection settings while replacing only the database name", () => {
    expect(
      replaceDatabaseName(
        "postgresql://user:secret@127.0.0.1:5432/postgres?sslmode=disable",
        "hub_smoke_123"
      )
    ).toBe(
      "postgresql://user:secret@127.0.0.1:5432/hub_smoke_123?sslmode=disable"
    );
  });

  it("rejects database names that cannot be safely interpolated into SQL", () => {
    expect(() =>
      replaceDatabaseName(
        "postgresql://user:secret@127.0.0.1:5432/postgres",
        "x;drop"
      )
    ).toThrow("O nome do banco de smoke e invalido.");
  });
});
