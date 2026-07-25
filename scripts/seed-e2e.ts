import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import PDFDocument from "pdfkit";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import { rebuildEnrollmentProjection } from "@/features/enrollments/server";
import { requireIsolatedE2eR2Bucket } from "@/features/storage/e2e-r2-guard";
import { deleteR2Objects, uploadPrivateR2Object } from "@/features/storage/r2";
import { getAuth } from "@/lib/auth";

const E2E_PASSWORD = "E2E-password-123!";
const FIXTURE_PATH = resolve(
  process.env.E2E_FIXTURE_PATH ?? ".e2e-fixture.json"
);

export interface E2eFixture {
  admin: { email: string; password: string };
  certificate: {
    pending: CertificateE2eRecord;
    ready: CertificateE2eRecord & { pdfStorageKey: string };
    revoked: CertificateE2eRecord;
    revokedCode: string;
    sensitiveSentinel: string;
    validCode: string;
  };
  cleanup: {
    courseIds: string[];
    pdfObjectKeys: string[];
    runPrefix: string;
  };
  course: { id: string; lessonOneId: string; lessonTwoId: string };
  runId: string;
  studentForCompletion: {
    email: string;
    id: string;
    password: string;
  };
  studentWithExpiredAccess: { email: string; id: string; password: string };
  studentWithGrant: {
    email: string;
    id: string;
    name: string;
    password: string;
  };
  studentWithoutGrant: { email: string; id: string; password: string };
  studentWithRevokedAccess: { email: string; id: string; password: string };
}

interface CertificateE2eRecord {
  code: string;
  courseId: string;
  courseTitle: string;
  id: string;
}

interface CertificateE2eSeed {
  code: string;
  kind: "pending" | "ready" | "revoked";
  title: string;
}

interface SeededCertificateE2eRecord extends CertificateE2eRecord {
  pdfStorageKey: string | null;
}

const requireE2eMode = (): void => {
  if (process.env.E2E_TEST_MODE !== "true") {
    throw new Error("seed-e2e requires E2E_TEST_MODE=true.");
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("seed-e2e requires DATABASE_URL.");
  }
};

const createUser = async ({
  email,
  name,
  role,
}: {
  email: string;
  name: string;
  role: "admin" | "student";
}): Promise<string> => {
  const result = await getAuth().api.signUpEmail({
    body: { email, name, password: E2E_PASSWORD },
  });
  const userId = result.user.id;

  await getPool().query(
    `
      insert into profiles (user_id, role)
      values ($1, $2::role)
      on conflict (user_id) do update
      set role = excluded.role,
          updated_at = now()
    `,
    [userId, role]
  );
  return userId;
};

const createMinimalCertificatePdf = async (): Promise<Buffer> =>
  await new Promise<Buffer>((resolvePdf, rejectPdf) => {
    const chunks: Buffer[] = [];
    const document = new PDFDocument({
      info: { Title: "Certificado E2E" },
      margin: 48,
      size: "A4",
    });
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolvePdf(Buffer.concat(chunks)));
    document.on("error", rejectPdf);
    document.fontSize(18).text("Certificado E2E");
    document.fontSize(10).text("Fixture privada para teste de download.");
    document.end();
  });

const seedCertificateRecord = async ({
  client,
  pdfSha256,
  sensitiveSentinel,
  seed,
  studentId,
  suffix,
}: {
  client: PoolClient;
  pdfSha256: string;
  sensitiveSentinel: string;
  seed: CertificateE2eSeed;
  studentId: string;
  suffix: string;
}): Promise<SeededCertificateE2eRecord> => {
  const { rows: certificateCourses } = await client.query<{ id: string }>(
    `
      insert into courses (
        slug, title, price_in_cents, workload_hours, status, certificate_enabled
      )
      values ($1, $2, 0, 2, 'active', false)
      returning id
    `,
    [`certificate-${seed.kind}-${suffix}`, seed.title]
  );
  const courseId = certificateCourses[0]?.id;
  if (!courseId) {
    throw new Error(`Could not create ${seed.kind} certificate course.`);
  }
  const { rows: certificatePublications } = await client.query<{ id: string }>(
    `
      insert into course_publications (
        course_id, publication_number, status, title_snapshot,
        workload_hours_snapshot, published_at
      )
      values ($1, 1, 'published', $2, 2, now())
      returning id
    `,
    [courseId, seed.title]
  );
  const publicationId = certificatePublications[0]?.id;
  if (!publicationId) {
    throw new Error(`Could not create ${seed.kind} certificate publication.`);
  }

  const isPending = seed.kind === "pending";
  const isRevoked = seed.kind === "revoked";
  let pdfStorageKey: string | null = null;
  if (seed.kind === "ready") {
    pdfStorageKey = `e2e/${suffix}/courses/${courseId}/certificate.pdf`;
  } else if (isRevoked) {
    pdfStorageKey = `e2e/certificates/${suffix}/revoked.pdf`;
  }
  const { rows: certificates } = await client.query<{ id: string }>(
    `
      insert into certificates (
        user_id, course_id, code, course_publication_id,
        student_name_snapshot, course_title_snapshot,
        workload_hours_snapshot, status, render_status, pdf_storage_key,
        pdf_sha256, rendered_at, revoked_at, revoked_reason,
        revoked_reason_category
      )
      values (
        $1, $2, $3, $4, 'Aluna com acesso', $5, 2,
        $6::certificate_status, $7::certificate_render_status, $8,
        $9, $10, $11, $12, $13
      )
      returning id
    `,
    [
      studentId,
      courseId,
      seed.code,
      publicationId,
      seed.title,
      isRevoked ? "revoked" : "valid",
      isPending ? "pending" : "ready",
      pdfStorageKey,
      isPending ? null : pdfSha256,
      isPending ? null : new Date(),
      isRevoked ? new Date() : null,
      isRevoked ? sensitiveSentinel : null,
      isRevoked ? "other" : null,
    ]
  );
  const certificateId = certificates[0]?.id;
  if (!certificateId) {
    throw new Error(`Could not create ${seed.kind} E2E certificate.`);
  }
  return {
    code: seed.code,
    courseId,
    courseTitle: seed.title,
    id: certificateId,
    pdfStorageKey,
  };
};

const seedCertificateLifecycle = async ({
  client,
  pdfSha256,
  sensitiveSentinel,
  studentId,
  suffix,
}: {
  client: PoolClient;
  pdfSha256: string;
  sensitiveSentinel: string;
  studentId: string;
  suffix: string;
}): Promise<{
  pending: CertificateE2eRecord;
  ready: CertificateE2eRecord & { pdfStorageKey: string };
  revoked: CertificateE2eRecord;
}> => {
  const certificateSeeds = [
    {
      code: `E2E-PENDING-${suffix}`,
      kind: "pending",
      title: "Certificado E2E em preparo",
    },
    {
      code: `E2E-READY-${suffix}`,
      kind: "ready",
      title: "Certificado E2E disponivel",
    },
    {
      code: `E2E-REVOKED-${suffix}`,
      kind: "revoked",
      title: "Certificado E2E revogado",
    },
  ] as const;
  const certificateRecords: Partial<
    Record<
      (typeof certificateSeeds)[number]["kind"],
      SeededCertificateE2eRecord
    >
  > = {};

  for (const certificateSeed of certificateSeeds) {
    certificateRecords[certificateSeed.kind] = await seedCertificateRecord({
      client,
      pdfSha256,
      sensitiveSentinel,
      seed: certificateSeed,
      studentId,
      suffix,
    });
  }

  const { pending, ready, revoked } = certificateRecords;
  if (!(pending && ready && revoked)) {
    throw new Error("Could not create the complete E2E certificate lifecycle.");
  }
  if (!ready.pdfStorageKey) {
    throw new Error("Could not create the ready E2E certificate artifact.");
  }
  return {
    pending,
    ready: { ...ready, pdfStorageKey: ready.pdfStorageKey },
    revoked,
  };
};

export const seedE2e = async (): Promise<E2eFixture> => {
  requireE2eMode();
  requireIsolatedE2eR2Bucket(process.env);

  const suffix = crypto.randomUUID().replaceAll("-", "");
  const sensitiveSentinel = `E2E-INTERNAL-SENSITIVE-CPF-FICTICIO-${suffix}`;
  const pdfBody = await createMinimalCertificatePdf();
  const pdfSha256 = createHash("sha256").update(pdfBody).digest("hex");
  const studentEmail = `sg${suffix}@example.com`;
  const completionStudentEmail = `sc${suffix}@example.com`;
  const noGrantEmail = `sn${suffix}@example.com`;
  const adminEmail = `ad${suffix}@example.com`;
  const [
    studentId,
    completionStudentId,
    noGrantId,
    ,
    expiredAccessStudentId,
    revokedAccessStudentId,
  ] = await Promise.all([
    createUser({
      email: studentEmail,
      name: "Aluna com acesso",
      role: "student",
    }),
    createUser({
      email: completionStudentEmail,
      name: "Aluna para conclusao",
      role: "student",
    }),
    createUser({
      email: noGrantEmail,
      name: "Aluna sem acesso",
      role: "student",
    }),
    createUser({ email: adminEmail, name: "Admin E2E", role: "admin" }),
    createUser({
      email: `se${suffix}@example.com`,
      name: "Aluna com acesso expirado",
      role: "student",
    }),
    createUser({
      email: `sr${suffix}@example.com`,
      name: "Aluna com acesso revogado",
      role: "student",
    }),
  ]);
  const pool = getPool();
  const client = await pool.connect();
  let uploadedPdfStorageKey: string | null = null;
  try {
    await client.query("begin");
    await client.query(
      `
        insert into certificate_issuer_profiles (
          id, legal_name, cnpj, display_name, course_free_statement
        ) values (
          'global',
          'Escola E2E Ltda',
          '12.345.678/0001-90',
          'Escola E2E',
          'Curso livre para fins de aperfeicoamento profissional.'
        )
        on conflict (id) do nothing
      `
    );
    const { rows: courses } = await client.query<{ id: string }>(
      `
        insert into courses (
          slug, title, price_in_cents, workload_hours, status, certificate_enabled
        )
        values ($1, 'Curso E2E', 9900, 2, 'active', false)
        returning id
      `,
      [`course-e2e-${suffix}`]
    );
    const courseId = courses[0]?.id;
    if (!courseId) {
      throw new Error("Could not create E2E course.");
    }
    const { rows: coursePublications } = await client.query<{ id: string }>(
      `
        insert into course_publications (
          course_id, publication_number, status, title_snapshot, workload_hours_snapshot, published_at
        ) values ($1, 1, 'published', 'Curso E2E', 2, now())
        returning id
      `,
      [courseId]
    );
    const coursePublicationId = coursePublications[0]?.id;
    if (!coursePublicationId) {
      throw new Error("Could not create E2E course publication.");
    }

    const { rows: modules } = await client.query<{ id: string }>(
      `insert into modules (course_id, course_publication_id, title, sort_order, status)
       values ($1, $2, 'Modulo E2E', 1, 'active') returning id`,
      [courseId, coursePublicationId]
    );
    const moduleId = modules[0]?.id;
    if (!moduleId) {
      throw new Error("Could not create E2E module.");
    }

    const lessonIds: string[] = [];
    for (const [sortOrder, title] of [
      "Primeira aula",
      "Segunda aula",
    ].entries()) {
      const { rows } = await client.query<{ id: string }>(
        `
          insert into lessons (module_id, course_publication_id, title, duration_seconds, sort_order, status)
          values ($1, $2, $3, 60, $4, 'active') returning id
        `,
        [moduleId, coursePublicationId, title, sortOrder + 1]
      );
      const lessonId = rows[0]?.id;
      if (!lessonId) {
        throw new Error("Could not create E2E lesson.");
      }
      lessonIds.push(lessonId);
    }

    await client.query(
      `
        insert into enrollment_grants (
          user_id, course_id, source_type, manual_reference, status,
          starts_at, base_expires_at, effective_expires_at
        ) values ($1, $2, 'manual', $3, 'active', now() - interval '1 minute',
                  now() + interval '30 days', now() + interval '30 days')
      `,
      [studentId, courseId, `e2e-${suffix}`]
    );
    await rebuildEnrollmentProjection({ client, courseId, userId: studentId });
    await client.query(
      `
        insert into enrollment_grants (
          user_id, course_id, source_type, manual_reference, status,
          starts_at, base_expires_at, effective_expires_at
        ) values ($1, $2, 'manual', $3, 'active', now() - interval '1 minute',
                  now() + interval '30 days', now() + interval '30 days')
      `,
      [completionStudentId, courseId, `e2e-completion-${suffix}`]
    );
    await rebuildEnrollmentProjection({
      client,
      courseId,
      userId: completionStudentId,
    });

    await client.query(
      `
        insert into enrollment_grants (
          user_id, course_id, source_type, manual_reference, status,
          starts_at, base_expires_at, effective_expires_at, revoked_at,
          revoked_reason
        ) values
          ($1, $2, 'manual', $3, 'active', now() - interval '31 days',
           now() - interval '1 day', now() - interval '1 day', null, null),
          ($4, $2, 'manual', $5, 'cancelled', now() - interval '31 days',
           now() - interval '1 day', now() - interval '1 day', now(),
           'abacatepay_dispute')
      `,
      [
        expiredAccessStudentId,
        courseId,
        `e2e-expired-${suffix}`,
        revokedAccessStudentId,
        `e2e-revoked-${suffix}`,
      ]
    );
    await rebuildEnrollmentProjection({
      client,
      courseId,
      userId: expiredAccessStudentId,
    });
    await rebuildEnrollmentProjection({
      client,
      courseId,
      userId: revokedAccessStudentId,
    });

    const certificateRecords = await seedCertificateLifecycle({
      client,
      pdfSha256,
      sensitiveSentinel,
      studentId,
      suffix,
    });
    await uploadPrivateR2Object({
      body: pdfBody,
      contentType: "application/pdf",
      key: certificateRecords.ready.pdfStorageKey,
    });
    uploadedPdfStorageKey = certificateRecords.ready.pdfStorageKey;
    await client.query("commit");

    const lessonOneId = lessonIds[0];
    const lessonTwoId = lessonIds[1];
    if (!(lessonOneId && lessonTwoId)) {
      throw new Error("Missing E2E lessons.");
    }

    const fixture: E2eFixture = {
      admin: { email: adminEmail, password: E2E_PASSWORD },
      certificate: {
        pending: certificateRecords.pending,
        ready: certificateRecords.ready,
        revoked: certificateRecords.revoked,
        revokedCode: certificateRecords.revoked.code,
        sensitiveSentinel,
        validCode: certificateRecords.ready.code,
      },
      cleanup: {
        courseIds: [
          courseId,
          certificateRecords.pending.courseId,
          certificateRecords.ready.courseId,
          certificateRecords.revoked.courseId,
        ],
        pdfObjectKeys: [certificateRecords.ready.pdfStorageKey],
        runPrefix: `e2e/${suffix}/`,
      },
      course: { id: courseId, lessonOneId, lessonTwoId },
      runId: suffix,
      studentForCompletion: {
        email: completionStudentEmail,
        id: completionStudentId,
        password: E2E_PASSWORD,
      },
      studentWithGrant: {
        email: studentEmail,
        id: studentId,
        name: "Aluna com acesso",
        password: E2E_PASSWORD,
      },
      studentWithExpiredAccess: {
        email: `se${suffix}@example.com`,
        id: expiredAccessStudentId,
        password: E2E_PASSWORD,
      },
      studentWithRevokedAccess: {
        email: `sr${suffix}@example.com`,
        id: revokedAccessStudentId,
        password: E2E_PASSWORD,
      },
      studentWithoutGrant: {
        email: noGrantEmail,
        id: noGrantId,
        password: E2E_PASSWORD,
      },
    };
    await writeFile(FIXTURE_PATH, `${JSON.stringify(fixture)}\n`, "utf8");
    return fixture;
  } catch (error) {
    await client.query("rollback");
    if (uploadedPdfStorageKey) {
      await deleteR2Objects([uploadedPdfStorageKey]).catch(() => undefined);
    }
    throw error;
  } finally {
    client.release();
  }
};

if (import.meta.main) {
  await seedE2e();
  await getPool().end();
}
