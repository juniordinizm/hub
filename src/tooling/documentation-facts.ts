export interface DocumentationFacts {
  currentMigrationTag: string;
  migrationEntryCount: number;
  schemaTableCount: number;
}

interface DeriveDocumentationFactsInput {
  journalContent: string;
  schemaSource: string;
}

interface ValidateDocumentationFactsInput {
  actual: DocumentationFacts;
  documented: DocumentationFacts;
}

interface JournalEntry {
  tag?: unknown;
}

interface Journal {
  entries?: unknown;
}

const METADATA_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const LINE_BREAK = /\r?\n/;
const EXPORTED_PG_TABLE =
  /export\s+const\s+[A-Za-z_$][\w$]*\s*=\s*pgTable\s*\(/g;
const POSITIVE_INTEGER = /^\d+$/;

const readMetadata = (content: string): Map<string, string> => {
  const match = content.match(METADATA_BLOCK);
  const metadata = new Map<string, string>();

  if (!match?.[1]) {
    return metadata;
  }

  for (const line of match[1].split(LINE_BREAK)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    metadata.set(
      line.slice(0, separatorIndex).trim(),
      line.slice(separatorIndex + 1).trim()
    );
  }

  return metadata;
};

const requiredMetadataValue = (
  metadata: Map<string, string>,
  key: string
): string => {
  const value = metadata.get(key)?.trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
};

const requiredMetadataInteger = (
  metadata: Map<string, string>,
  key: string
): number => {
  const value = requiredMetadataValue(metadata, key);
  if (!POSITIVE_INTEGER.test(value)) {
    throw new Error(`${key} must be a non-negative integer`);
  }
  return Number.parseInt(value, 10);
};

export const deriveDocumentationFacts = ({
  journalContent,
  schemaSource,
}: DeriveDocumentationFactsInput): DocumentationFacts => {
  const journal = JSON.parse(journalContent) as Journal;
  if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
    throw new Error("migration journal must contain at least one entry");
  }

  const entries = journal.entries as JournalEntry[];
  const currentMigrationTag = entries.at(-1)?.tag;
  if (typeof currentMigrationTag !== "string" || !currentMigrationTag.trim()) {
    throw new Error("latest migration journal entry must have a tag");
  }

  return {
    currentMigrationTag: currentMigrationTag.trim(),
    migrationEntryCount: entries.length,
    schemaTableCount: [...schemaSource.matchAll(EXPORTED_PG_TABLE)].length,
  };
};

export const readDocumentationFactsMetadata = (
  content: string
): DocumentationFacts => {
  const metadata = readMetadata(content);
  return {
    currentMigrationTag: requiredMetadataValue(
      metadata,
      "current_migration_tag"
    ),
    migrationEntryCount: requiredMetadataInteger(
      metadata,
      "migration_entry_count"
    ),
    schemaTableCount: requiredMetadataInteger(metadata, "schema_table_count"),
  };
};

export const validateDocumentationFacts = ({
  actual,
  documented,
}: ValidateDocumentationFactsInput): string[] => {
  const errors: string[] = [];

  if (actual.currentMigrationTag !== documented.currentMigrationTag) {
    errors.push("current_migration_tag does not match the journal");
  }
  if (actual.migrationEntryCount !== documented.migrationEntryCount) {
    errors.push("migration_entry_count does not match the journal");
  }
  if (actual.schemaTableCount !== documented.schemaTableCount) {
    errors.push("schema_table_count does not match the exported schema");
  }

  return errors;
};
