import { describe, expect, it } from "vitest";
import { validateMigrationIntegrity } from "./migration-integrity";

describe("validateMigrationIntegrity", () => {
  it("reports a duplicate migration number", () => {
    const result = validateMigrationIntegrity({
      journalTags: ["0000_initial", "0001_accounts"],
      migrationFileNames: [
        "0000_initial.sql",
        "0001_accounts.sql",
        "0001_profiles.sql",
      ],
    });

    expect(result.errors).toContain(
      "Numero de migration duplicado: 0001 (0001_accounts.sql, 0001_profiles.sql)."
    );
  });

  it("reports migrations missing from the journal and journal entries without SQL", () => {
    const result = validateMigrationIntegrity({
      journalTags: ["0000_initial", "0002_missing"],
      migrationFileNames: ["0000_initial.sql", "0001_profiles.sql"],
    });

    expect(result.errors).toContain(
      "Migration sem entrada no journal: 0001_profiles.sql."
    );
    expect(result.errors).toContain(
      "Entrada do journal sem arquivo SQL: 0002_missing."
    );
  });

  it("reports filenames that do not follow the migration convention", () => {
    const result = validateMigrationIntegrity({
      journalTags: [],
      migrationFileNames: ["migration.sql"],
    });

    expect(result.errors).toEqual([
      "Nome de migration invalido: migration.sql. Use NNNN_slug.sql.",
    ]);
  });

  it("accepts matching, ordered migrations", () => {
    const result = validateMigrationIntegrity({
      journalTags: ["0000_initial", "0001_profiles"],
      migrationFileNames: ["0000_initial.sql", "0001_profiles.sql"],
    });

    expect(result.errors).toEqual([]);
  });

  it("reports stale snapshots that do not match the journal", () => {
    const result = validateMigrationIntegrity({
      journalTags: ["0000_initial", "0001_profiles"],
      migrationFileNames: ["0000_initial.sql", "0001_profiles.sql"],
      snapshotFileNames: ["0000_snapshot.json", "0002_snapshot.json"],
    });

    expect(result.errors).toContain(
      "Snapshot sem entrada correspondente no journal: 0002_snapshot.json."
    );
    expect(result.errors).toContain(
      "Snapshot mais recente divergente do journal: esperado 0001_snapshot.json."
    );
  });
});
