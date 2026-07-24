import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveLatestSnapshotFileName,
  validateCertificateCatalogParity,
} from "./certificate-catalog-integrity";

const repositoryRoot = join(import.meta.dirname, "../..");
const schemaPath = join(repositoryRoot, "src/db/schema.ts");
const migrationsPath = join(repositoryRoot, "src/db/migrations");
const journalPath = join(migrationsPath, "meta/_journal.json");
const SNAPSHOT_FILE_PATTERN = /^\d{4}_snapshot\.json$/;

interface DrizzleJournal {
  entries: Array<{ tag: string }>;
}

const loadCurrentCatalog = async (): Promise<{
  schemaSource: string;
  snapshot: unknown;
  snapshotFileName: string;
}> => {
  const [journalSource, schemaSource] = await Promise.all([
    readFile(journalPath, "utf8"),
    readFile(schemaPath, "utf8"),
  ]);
  const journal = JSON.parse(journalSource) as DrizzleJournal;
  const snapshotFileName = resolveLatestSnapshotFileName(
    journal.entries.map((entry) => entry.tag)
  );
  const snapshot = JSON.parse(
    await readFile(join(migrationsPath, "meta", snapshotFileName), "utf8")
  ) as unknown;

  return { schemaSource, snapshot, snapshotFileName };
};

describe("certificate migration catalog", () => {
  it("derives the authoritative snapshot from the latest journal entry", () => {
    expect(
      resolveLatestSnapshotFileName([
        "0038_certificate_snapshot_baseline",
        "0039_certificate_snapshot_final",
        "0099_future_catalog_change",
      ])
    ).toBe("0099_snapshot.json");
  });

  it("keeps schema and latest Drizzle snapshot aligned with the certificate catalog", async () => {
    const { schemaSource, snapshot, snapshotFileName } =
      await loadCurrentCatalog();

    expect(snapshotFileName).toMatch(SNAPSHOT_FILE_PATTERN);
    expect(
      validateCertificateCatalogParity({ schemaSource, snapshot }).errors
    ).toEqual([]);
  });

  it("detects misplaced legacy and incomplete render-claim declarations", async () => {
    const { schemaSource, snapshot } = await loadCurrentCatalog();
    const invalidSnapshot = structuredClone(snapshot) as {
      tables: Record<
        string,
        {
          checkConstraints?: Record<string, unknown>;
          columns: Record<string, unknown>;
        }
      >;
    };
    const certificates = invalidSnapshot.tables["public.certificates"];
    const coursePublications =
      invalidSnapshot.tables["public.course_publications"];

    if (!(certificates && coursePublications)) {
      throw new Error("Fixture de catalogo incompleta.");
    }

    coursePublications.columns.certificate_template_id = {
      name: "certificate_template_id",
    };
    certificates.columns.pdf_url = { name: "pdf_url" };
    Reflect.deleteProperty(certificates.columns, "render_claim_token");
    if (certificates.checkConstraints) {
      Reflect.deleteProperty(
        certificates.checkConstraints,
        "certificates_ready_artifact_check"
      );
    }

    const result = validateCertificateCatalogParity({
      schemaSource,
      snapshot: invalidSnapshot,
    });

    expect(result.errors).toContain(
      "certificate_template_id deve existir somente em public.certificates."
    );
    expect(result.errors).toContain(
      "Snapshot de certificates sem coluna render_claim_token."
    );
    expect(result.errors).toContain(
      "Catalogo legado ainda contem a coluna removida pdf_url."
    );
    expect(result.errors).toContain(
      "Snapshot sem check certificates_ready_artifact_check."
    );
  });

  it("rejects checks that mention the right columns with the wrong semantics", async () => {
    const { schemaSource, snapshot } = await loadCurrentCatalog();
    const invalidSnapshot = structuredClone(snapshot) as {
      tables: Record<
        string,
        {
          checkConstraints?: Record<string, { value: string }>;
          columns: Record<string, unknown>;
        }
      >;
    };
    const checks =
      invalidSnapshot.tables["public.certificates"]?.checkConstraints;

    if (!checks) {
      throw new Error("Fixture sem checks de certificates.");
    }

    checks.certificates_render_claim_pair_check = {
      value:
        '"certificates"."render_claim_token" is null or "certificates"."render_claimed_at" is null',
    };
    checks.certificates_ready_artifact_check = {
      value:
        '"certificates"."render_status" <> \'ready\' or "certificates"."pdf_storage_key" is not null or "certificates"."pdf_sha256" is not null or "certificates"."rendered_at" is not null or "certificates"."render_claim_token" is null',
    };

    const result = validateCertificateCatalogParity({
      schemaSource,
      snapshot: invalidSnapshot,
    });

    expect(result.errors).toContain(
      "Check certificates_render_claim_pair_check diverge da expressao esperada."
    );
    expect(result.errors).toContain(
      "Check certificates_ready_artifact_check diverge da expressao esperada."
    );
  });
});
