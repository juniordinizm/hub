import { describe, expect, it } from "vitest";
import {
  deriveDocumentationFacts,
  readDocumentationFactsMetadata,
  validateDocumentationFacts,
} from "./documentation-facts";

const journal = JSON.stringify({
  entries: [{ tag: "0066_previous" }, { tag: "0067_current" }],
});
const schema = `
export const users = pgTable("users", {});
export const orders = pgTable(
  "orders",
  {}
);
const privateTable = pgTable("private", {});
`;

describe("documentation facts", () => {
  it("derives the current journal and exported pgTable facts", () => {
    expect(
      deriveDocumentationFacts({
        journalContent: journal,
        schemaSource: schema,
      })
    ).toEqual({
      currentMigrationTag: "0067_current",
      migrationEntryCount: 2,
      schemaTableCount: 2,
    });
  });

  it("reads structured runbook metadata and detects every alteration", () => {
    const document = `---
status: runbook
owner: engineering
last_verified_commit: ${"a".repeat(40)}
current_migration_tag: 0067_current
migration_entry_count: 2
schema_table_count: 2
---`;
    const metadata = readDocumentationFactsMetadata(document);
    expect(
      validateDocumentationFacts({
        actual: deriveDocumentationFacts({
          journalContent: journal,
          schemaSource: schema,
        }),
        documented: metadata,
      })
    ).toEqual([]);
    expect(
      validateDocumentationFacts({
        actual: {
          currentMigrationTag: "0067_current",
          migrationEntryCount: 2,
          schemaTableCount: 2,
        },
        documented: { ...metadata, migrationEntryCount: 999 },
      })
    ).toContain("migration_entry_count does not match the journal");
  });

  it("rejects missing or malformed structured facts", () => {
    expect(() =>
      readDocumentationFactsMetadata(`---
current_migration_tag: 0067_current
migration_entry_count: two
---`)
    ).toThrow("migration_entry_count must be a non-negative integer");
  });
});
