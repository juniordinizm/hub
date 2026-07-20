import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateMigrationIntegrity } from "../src/db/migration-integrity";

interface DrizzleJournal {
  entries: Array<{ tag: string }>;
}

const migrationsDirectory = join(import.meta.dirname, "../src/db/migrations");
const journalPath = join(migrationsDirectory, "meta/_journal.json");

const main = async (): Promise<void> => {
  const [directoryEntries, journalContent] = await Promise.all([
    readdir(migrationsDirectory, { withFileTypes: true }),
    readFile(journalPath, "utf8"),
  ]);
  const journal = JSON.parse(journalContent) as DrizzleJournal;
  const result = validateMigrationIntegrity({
    journalTags: journal.entries.map((entry) => entry.tag),
    migrationFileNames: directoryEntries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
      .map((entry) => entry.name)
      .sort(),
    snapshotFileNames: (
      await readdir(join(migrationsDirectory, "meta"), { withFileTypes: true })
    )
      .filter(
        (entry) => entry.isFile() && entry.name.endsWith("_snapshot.json")
      )
      .map((entry) => entry.name)
      .sort(),
  });

  if (result.errors.length === 0) {
    console.log("Migrations validas.");
    return;
  }

  for (const error of result.errors) {
    console.error(`- ${error}`);
  }

  process.exitCode = 1;
};

await main();
