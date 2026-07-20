const MIGRATION_FILE_NAME = /^(\d{4})_([a-z0-9_]+)\.sql$/;
const MIGRATION_TAG = /^(\d{4})_([a-z0-9_]+)$/;
const SNAPSHOT_FILE_NAME = /^(\d{4})_snapshot\.json$/;
const SQL_EXTENSION = /\.sql$/;

interface ParsedMigrationFile {
  fileName: string;
  number: string;
  tag: string;
}

interface ParsedMigrationTag {
  number: string;
  tag: string;
}

export interface MigrationIntegrityInput {
  journalTags: string[];
  migrationFileNames: string[];
  snapshotFileNames?: string[];
}

export interface MigrationIntegrityResult {
  errors: string[];
}

const parseMigrationFile = (fileName: string): ParsedMigrationFile | null => {
  const match = MIGRATION_FILE_NAME.exec(fileName);

  const number = match?.[1];

  if (!number) {
    return null;
  }

  return {
    fileName,
    number,
    tag: fileName.replace(SQL_EXTENSION, ""),
  };
};

const parseMigrationTag = (tag: string): ParsedMigrationTag | null => {
  const match = MIGRATION_TAG.exec(tag);

  const number = match?.[1];

  if (!number) {
    return null;
  }

  return {
    number,
    tag,
  };
};

const validateSnapshotIntegrity = (
  journalTags: ParsedMigrationTag[],
  snapshotFileNames: string[]
): string[] => {
  const errors: string[] = [];
  const journalNumbers = new Set(
    journalTags.map((journalTag) => journalTag.number)
  );
  const snapshotNumbers = new Set<string>();

  for (const snapshotFileName of snapshotFileNames) {
    const snapshotMatch = SNAPSHOT_FILE_NAME.exec(snapshotFileName);
    const snapshotNumber = snapshotMatch?.[1];

    if (!snapshotNumber) {
      errors.push(`Nome de snapshot invalido: ${snapshotFileName}.`);
      continue;
    }

    if (snapshotNumbers.has(snapshotNumber)) {
      errors.push(`Numero de snapshot duplicado: ${snapshotNumber}.`);
    }
    snapshotNumbers.add(snapshotNumber);

    if (!journalNumbers.has(snapshotNumber)) {
      errors.push(
        `Snapshot sem entrada correspondente no journal: ${snapshotFileName}.`
      );
    }
  }

  const latestJournalNumber = journalTags.at(-1)?.number;
  const latestSnapshotNumber = [...snapshotNumbers].sort().at(-1);

  if (
    latestJournalNumber &&
    latestSnapshotNumber &&
    latestSnapshotNumber !== latestJournalNumber
  ) {
    errors.push(
      `Snapshot mais recente divergente do journal: esperado ${latestJournalNumber}_snapshot.json.`
    );
  }

  return errors;
};

export const validateMigrationIntegrity = ({
  journalTags,
  migrationFileNames,
  snapshotFileNames = [],
}: MigrationIntegrityInput): MigrationIntegrityResult => {
  const errors: string[] = [];
  const parsedFiles: ParsedMigrationFile[] = [];

  for (const fileName of migrationFileNames) {
    const parsed = parseMigrationFile(fileName);

    if (!parsed) {
      errors.push(
        `Nome de migration invalido: ${fileName}. Use NNNN_slug.sql.`
      );
      continue;
    }

    parsedFiles.push(parsed);
  }

  const filesByNumber = new Map<string, ParsedMigrationFile[]>();
  for (const file of parsedFiles) {
    const files = filesByNumber.get(file.number) ?? [];
    files.push(file);
    filesByNumber.set(file.number, files);
  }

  for (const [number, files] of filesByNumber) {
    if (files.length > 1) {
      errors.push(
        `Numero de migration duplicado: ${number} (${files
          .map((file) => file.fileName)
          .join(", ")}).`
      );
    }
  }

  const migrationTags = new Set(parsedFiles.map((file) => file.tag));
  const parsedJournalTags: ParsedMigrationTag[] = [];

  for (const journalTag of journalTags) {
    const parsed = parseMigrationTag(journalTag);

    if (!parsed) {
      errors.push(`Entrada do journal invalida: ${journalTag}.`);
      continue;
    }

    parsedJournalTags.push(parsed);

    if (!migrationTags.has(journalTag)) {
      errors.push(`Entrada do journal sem arquivo SQL: ${journalTag}.`);
    }
  }

  const journalTagSet = new Set(journalTags);
  for (const file of parsedFiles) {
    if (!journalTagSet.has(file.tag)) {
      errors.push(`Migration sem entrada no journal: ${file.fileName}.`);
    }
  }

  for (let index = 1; index < parsedJournalTags.length; index += 1) {
    const previous = parsedJournalTags[index - 1];
    const current = parsedJournalTags[index];

    if (previous && current && previous.number > current.number) {
      errors.push(
        `Ordem numerica do journal invalida: ${previous.tag} aparece antes de ${current.tag}.`
      );
    }
  }

  errors.push(
    ...validateSnapshotIntegrity(parsedJournalTags, snapshotFileNames)
  );

  return { errors };
};
