import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getPool } from "@/db";
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

export const teardownE2e = async (): Promise<void> => {
  requireE2eMode();
  requireIsolatedE2eR2Bucket(process.env);
  const fixture = await readFixture();
  const pool = getPool();

  try {
    const { rows } = await pool.query<{
      background_key: string;
      signature_key: string | null;
    }>(
      `
        select background_key, signature_key
        from certificate_templates
        where course_id = any($1::uuid[])
      `,
      [fixture.cleanup.courseIds]
    );
    const templateKeys = rows.flatMap((row) =>
      row.signature_key
        ? [row.background_key, row.signature_key]
        : [row.background_key]
    );
    const invalidTemplateKey = templateKeys.find(
      (key) => !isTemplateKeyOwnedByFixture(key, fixture.cleanup.courseIds)
    );
    if (invalidTemplateKey) {
      throw new Error("Refusing to delete a template outside E2E course IDs.");
    }
    const invalidPdfKey = fixture.cleanup.pdfObjectKeys.find(
      (key) => !key.startsWith(fixture.cleanup.runPrefix)
    );
    if (invalidPdfKey) {
      throw new Error("Refusing to delete a PDF outside the E2E run prefix.");
    }

    await deleteR2Objects([...fixture.cleanup.pdfObjectKeys, ...templateKeys]);
  } finally {
    await pool.end();
  }
};

if (import.meta.main) {
  await teardownE2e();
}
