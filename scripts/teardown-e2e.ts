import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getPool } from "@/db";
import { assertSafeE2eDatabaseEnvironment } from "@/db/e2e-database-guard";
import { requireIsolatedE2eR2Bucket } from "@/features/storage/e2e-r2-guard";
import { deleteR2Objects } from "@/features/storage/r2";
import type { E2eFixture } from "./seed-e2e";

const FIXTURE_PATH = resolve(
  process.env.E2E_FIXTURE_PATH ?? ".e2e-fixture.json"
);

const requireE2eMode = (): void => {
  if (process.env.E2E_TEST_MODE !== "true") {
    throw new Error("teardown-e2e requires E2E_TEST_MODE=true.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("teardown-e2e requires DATABASE_URL.");
  }
  assertSafeE2eDatabaseEnvironment(process.env);
};

const readFixture = async (): Promise<E2eFixture> =>
  JSON.parse(await readFile(FIXTURE_PATH, "utf8")) as E2eFixture;

const isTemplateKeyOwnedByFixture = (
  key: string,
  courseIds: string[]
): boolean =>
  courseIds.some((courseId) =>
    key.startsWith(`certificates/templates/${courseId}/`)
  );

interface CertificatePdfRow {
  id: string;
  pdf_storage_key: string;
}

interface CertificateTemplateRow {
  background_key: string;
  signature_key: string | null;
}

export const collectOwnedE2eObjectKeys = ({
  certificatePdfRows,
  cleanup,
  templateRows,
}: {
  certificatePdfRows: CertificatePdfRow[];
  cleanup: E2eFixture["cleanup"];
  templateRows: CertificateTemplateRow[];
}): string[] => {
  const templateKeys = templateRows.flatMap((row) =>
    row.signature_key
      ? [row.background_key, row.signature_key]
      : [row.background_key]
  );
  const invalidTemplateKey = templateKeys.find(
    (key) => !isTemplateKeyOwnedByFixture(key, cleanup.courseIds)
  );
  if (invalidTemplateKey) {
    throw new Error("Refusing to delete a template outside E2E course IDs.");
  }

  const invalidFixturePdfKey = cleanup.pdfObjectKeys.find(
    (key) => !key.startsWith(cleanup.runPrefix)
  );
  if (invalidFixturePdfKey) {
    throw new Error("Refusing to delete a PDF outside the E2E run prefix.");
  }

  const invalidGeneratedPdf = certificatePdfRows.find(
    (row) => row.pdf_storage_key !== `certificates/${row.id}/certificate.pdf`
  );
  if (invalidGeneratedPdf) {
    throw new Error(
      "Refusing to delete a certificate PDF outside its owned E2E certificate."
    );
  }

  return [
    ...new Set([
      ...cleanup.pdfObjectKeys,
      ...certificatePdfRows.map((row) => row.pdf_storage_key),
      ...templateKeys,
    ]),
  ];
};

export const teardownE2e = async (): Promise<void> => {
  requireE2eMode();
  requireIsolatedE2eR2Bucket(process.env);
  const fixture = await readFixture();
  const pool = getPool();

  try {
    const [templateResult, certificatePdfResult] = await Promise.all([
      pool.query<CertificateTemplateRow>(
        `
          select background_key, signature_key
          from certificate_templates
          where course_id = any($1::uuid[])
        `,
        [fixture.cleanup.courseIds]
      ),
      pool.query<CertificatePdfRow>(
        `
          select id, pdf_storage_key
          from certificates
          where course_id = any($1::uuid[])
            and pdf_storage_key is not null
        `,
        [[fixture.certifiableCourse.id]]
      ),
    ]);
    const ownedObjectKeys = collectOwnedE2eObjectKeys({
      certificatePdfRows: certificatePdfResult.rows,
      cleanup: fixture.cleanup,
      templateRows: templateResult.rows,
    });

    await deleteR2Objects(ownedObjectKeys);
  } finally {
    await pool.end();
  }
};

if (import.meta.main) {
  await teardownE2e();
}
