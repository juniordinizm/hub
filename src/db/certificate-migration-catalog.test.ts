import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(import.meta.dirname, "../..");
const schemaPath = join(repositoryRoot, "src/db/schema.ts");
const migrationsPath = join(repositoryRoot, "src/db/migrations");

interface DrizzleSnapshot {
  enums: Record<string, unknown>;
  tables: Record<
    string,
    {
      columns: Record<string, unknown>;
    }
  >;
}

const getSnapshotTable = (
  snapshot: DrizzleSnapshot,
  tableName: string
): { columns: Record<string, unknown> } => {
  const table = snapshot.tables[tableName];

  if (!table) {
    throw new Error(`Snapshot nao contem a tabela esperada: ${tableName}`);
  }

  return table;
};

describe("certificate migration catalog", () => {
  it("keeps the schema and latest Drizzle snapshot aligned with the certificate catalog", async () => {
    const [schema, snapshotSource] = await Promise.all([
      readFile(schemaPath, "utf8"),
      readFile(join(migrationsPath, "meta/0039_snapshot.json"), "utf8"),
    ]);
    const snapshot = JSON.parse(snapshotSource) as DrizzleSnapshot;
    const certificatesTable = getSnapshotTable(snapshot, "public.certificates");
    const coursePublicationsTable = getSnapshotTable(
      snapshot,
      "public.course_publications"
    );
    const analyticsEventsTable = getSnapshotTable(
      snapshot,
      "public.learning_analytics_events"
    );

    expect(schema).toContain(
      'certificateTemplateId: uuid("certificate_template_id")'
    );
    const coursePublications = schema.slice(
      schema.indexOf("export const coursePublications"),
      schema.indexOf("export const modules")
    );

    expect(coursePublications).not.toContain("certificateTemplateId");
    expect(snapshot.tables).toHaveProperty(
      "public.certificate_issuer_profiles"
    );
    expect(snapshot.tables).toHaveProperty("public.certificate_templates");
    expect(certificatesTable.columns).toHaveProperty("certificate_template_id");
    expect(coursePublicationsTable.columns).not.toHaveProperty(
      "certificate_template_id"
    );
    expect(analyticsEventsTable.columns).not.toHaveProperty(
      "certificate_template_id"
    );
    expect(certificatesTable.columns).toHaveProperty("pdf_storage_key");
    expect(certificatesTable.columns).not.toHaveProperty("pdf_url");
    expect(snapshot.enums).toHaveProperty("public.certificate_render_status");
    expect(snapshot.enums).toHaveProperty("public.certificate_template_status");
  });
});
