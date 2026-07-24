import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  resolveLatestSnapshotFileName,
  validateCertificateCatalogParity,
} from "../src/db/certificate-catalog-integrity";
import { validateMigrationIntegrity } from "../src/db/migration-integrity";

interface DrizzleJournal {
  entries: Array<{ tag: string }>;
}

const migrationsDirectory = join(import.meta.dirname, "../src/db/migrations");
const journalPath = join(migrationsDirectory, "meta/_journal.json");
const schemaPath = join(import.meta.dirname, "../src/db/schema.ts");

const main = async (): Promise<void> => {
  const [directoryEntries, journalContent, schemaSource, snapshotEntries] =
    await Promise.all([
      readdir(migrationsDirectory, { withFileTypes: true }),
      readFile(journalPath, "utf8"),
      readFile(schemaPath, "utf8"),
      readdir(join(migrationsDirectory, "meta"), { withFileTypes: true }),
    ]);
  const journal = JSON.parse(journalContent) as DrizzleJournal;
  const journalTags = journal.entries.map((entry) => entry.tag);
  const migrationResult = validateMigrationIntegrity({
    journalTags,
    migrationFileNames: directoryEntries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
      .map((entry) => entry.name)
      .sort(),
    snapshotFileNames: snapshotEntries
      .filter(
        (entry) => entry.isFile() && entry.name.endsWith("_snapshot.json")
      )
      .map((entry) => entry.name)
      .sort(),
  });
  const errors = [...migrationResult.errors];

  try {
    const latestSnapshotFileName = resolveLatestSnapshotFileName(journalTags);
    const latestSnapshot = JSON.parse(
      await readFile(
        join(migrationsDirectory, "meta", latestSnapshotFileName),
        "utf8"
      )
    ) as unknown;
    errors.push(
      ...validateCertificateCatalogParity({
        schemaSource,
        snapshot: latestSnapshot,
      }).errors
    );
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : "Nao foi possivel validar o catalogo de certificados."
    );
  }

  if (errors.length === 0) {
    console.log("Migrations validas.");
    return;
  }

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exitCode = 1;
};

await main();
