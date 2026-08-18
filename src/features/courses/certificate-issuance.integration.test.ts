import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { withVerifiedSslMode } from "@/db/connection-url";
import { createDefaultCertificateTemplateFields } from "@/features/certificates/template-rules";

const databaseUrl = process.env.CERTIFICATE_CONCURRENCY_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "CERTIFICATE_CONCURRENCY_DATABASE_URL is required for integration tests."
  );
}
const AUTOMATIC_CERTIFICATE_CODE = /^PRT-[0-9A-F]{32}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CONSECUTIVE_ISSUANCE_RUNS = 20;
const CONSECUTIVE_ISSUANCE_TIMEOUT_MS = 120_000;

const dependencies = vi.hoisted(() => ({
  createR2ObjectReadUrl: vi.fn(),
  getPool: vi.fn(),
  renderCertificatePdf: vi.fn(),
  resolveLessonAccess: vi.fn(),
  uploadPrivateR2ObjectIfAbsent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/enrollments/access", () => ({
  resolveLessonAccess: dependencies.resolveLessonAccess,
}));
vi.mock("@/features/certificates/rendering", () => ({
  renderCertificatePdf: dependencies.renderCertificatePdf,
}));
vi.mock("@/features/storage/r2", () => ({
  createR2ObjectReadUrl: dependencies.createR2ObjectReadUrl,
  uploadPrivateR2ObjectIfAbsent: dependencies.uploadPrivateR2ObjectIfAbsent,
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ CERTIFICATE_PUBLIC_BASE_URL: "https://hub.test" }),
}));

import {
  reconcileHistoricalCourseCertificates,
  reissueCertificate,
  renderPendingCertificate,
  revokeCertificate,
  tryIssueAutomaticCompletionCertificate,
} from "../certificates/server";
import { deliverOutboxMessage } from "../outbox/delivery";
import {
  claimOutboxMessages,
  markOutboxMessageDeadLetter,
  markOutboxMessageDeferred,
  markOutboxMessageDelivered,
  markOutboxMessageForRetry,
  requeueDeadLetterMessage,
} from "../outbox/server";
import { processClaimedOutboxMessage } from "../outbox/worker";
import { completeLesson, recordLessonWatchProgress } from "./server";

const pool = new Pool({ connectionString: withVerifiedSslMode(databaseUrl) });
let storedCertificatePdf: Buffer | null = null;

const storeCertificatePdfIfAbsent = ({
  body,
}: {
  body: Buffer;
}): "created" | "existing" => {
  if (storedCertificatePdf) {
    return "existing";
  }
  storedCertificatePdf = body;
  return "created";
};

const fetchCertificateAsset = (url: string): Response => {
  if (!url.endsWith("certificate.pdf")) {
    return new Response(new Uint8Array(Buffer.from("asset")), { status: 200 });
  }
  if (storedCertificatePdf) {
    return new Response(new Uint8Array(storedCertificatePdf));
  }
  return new Response(null, { status: 404 });
};

const getTestPool = (): Pool => pool;

const createFixture = async ({
  withSecondRequiredLesson = false,
}: {
  withSecondRequiredLesson?: boolean;
} = {}): Promise<{
  courseId: string;
  coursePublicationId: string;
  lessonId: string;
  secondLessonId: string | null;
  sequenceUnlockLessonId: string | null;
  userId: string;
}> => {
  const testPool = getTestPool();

  const userId = `certificate-student-${randomUUID()}`;
  const { rows: courseRows } = await testPool.query<{ id: string }>(
    `
      insert into courses (slug, title, workload_hours, status, certificate_enabled)
      values ($1, 'Curso de concorrencia', 8, 'active', true)
      returning id
    `,
    [`certificate-concurrency-${randomUUID()}`]
  );
  const courseId = courseRows[0]?.id;

  if (!courseId) {
    throw new Error("Nao foi possivel criar o curso de teste.");
  }
  const { rows: coursePublicationRows } = await testPool.query<{ id: string }>(
    `
      insert into course_publications (
        course_id, publication_number, status, title_snapshot, workload_hours_snapshot, published_at
      ) values ($1, 1, 'published', 'Curso de concorrencia', 8, now())
      returning id
    `,
    [courseId]
  );
  const coursePublicationId = coursePublicationRows[0]?.id;
  if (!coursePublicationId) {
    throw new Error("Nao foi possivel criar a publicacao do curso de teste.");
  }

  await testPool.query(
    `
      insert into certificate_issuer_profiles (
        id, legal_name, cnpj, display_name
      )
      values (
        'global',
        'Emissora de teste LTDA',
        '00.000.000/0001-00',
        'Emissora de teste'
      )
      on conflict (id) do nothing
    `
  );
  await testPool.query(
    `
      insert into certificate_templates (
        course_id, version, status, background_key, spec, published_at
      )
      values ($1, 1, 'published', $2, $3::jsonb, now())
    `,
    [
      courseId,
      `certificates/test-backgrounds/${courseId}.png`,
      JSON.stringify({
        backgroundKey: `certificates/test-backgrounds/${courseId}.png`,
        fields: createDefaultCertificateTemplateFields(),
      }),
    ]
  );

  const { rows: moduleRows } = await testPool.query<{ id: string }>(
    `
      insert into modules (course_id, course_publication_id, title, sort_order, status)
      values ($1, $2, 'Modulo final', 1, 'active')
      returning id
    `,
    [courseId, coursePublicationId]
  );
  const moduleId = moduleRows[0]?.id;

  if (!moduleId) {
    throw new Error("Nao foi possivel criar o modulo de teste.");
  }

  const { rows: lessonRows } = await testPool.query<{ id: string }>(
    `
      insert into lessons (
        module_id,
        course_publication_id,
        title,
        duration_seconds,
        video_duration_seconds,
        sort_order,
        status,
        video_provider
      )
      values ($1, $2, 'Aula final', 120, 120, 1, 'active', 'jmvstream')
      returning id
    `,
    [moduleId, coursePublicationId]
  );
  const lessonId = lessonRows[0]?.id;

  if (!lessonId) {
    throw new Error("Nao foi possivel criar a aula de teste.");
  }

  let secondLessonId: string | null = null;
  let sequenceUnlockLessonId: string | null = null;
  if (withSecondRequiredLesson) {
    const { rows: finalLessonRows } = await testPool.query<{
      id: string;
      is_required: boolean;
    }>(
      `
        insert into lessons (
          module_id,
          course_publication_id,
          title,
          duration_seconds,
          video_duration_seconds,
          sort_order,
          status,
          video_provider,
          is_required
        )
        values
          ($1, $2, 'Segunda aula final', 120, 120, 2, 'active', 'jmvstream', true),
          ($1, $2, 'Aula opcional posterior', 120, 120, 3, 'active', 'jmvstream', false)
        returning id, is_required
      `,
      [moduleId, coursePublicationId]
    );
    secondLessonId =
      finalLessonRows.find((lesson) => lesson.is_required)?.id ?? null;
    sequenceUnlockLessonId =
      finalLessonRows.find((lesson) => !lesson.is_required)?.id ?? null;
    if (!(secondLessonId && sequenceUnlockLessonId)) {
      throw new Error("Nao foi possivel criar as aulas finais de teste.");
    }
  }

  await testPool.query(
    `
      insert into users (id, name, email, email_verified)
      values ($1, 'Aluna de concorrencia', $2, true)
    `,
    [userId, `${userId}@example.test`]
  );
  await testPool.query(
    `
      insert into enrollments (user_id, course_id, status, starts_at, expires_at)
      values ($1, $2, 'active', now() - interval '1 minute', now() + interval '1 day')
    `,
    [userId, courseId]
  );

  return {
    courseId,
    coursePublicationId,
    lessonId,
    secondLessonId,
    sequenceUnlockLessonId,
    userId,
  };
};

const countLessonProgress = async (userId: string, lessonIds: string[]) => {
  const { rows } = await getTestPool().query<{ count: string }>(
    `
      select count(*)
      from lesson_progress
      where user_id = $1 and lesson_id = any($2::uuid[])
    `,
    [userId, lessonIds]
  );
  return Number(rows[0]?.count ?? 0);
};

const countWaitingAdvisoryLocks = async ({
  committingOnly = false,
}: {
  committingOnly?: boolean;
} = {}): Promise<number> => {
  const { rows } = await getTestPool().query<{ count: string }>(
    `
      select count(*)
      from pg_stat_activity
      where datname = current_database()
        and wait_event_type = 'Lock'
        and wait_event = 'advisory'
        and ($1::boolean = false or lower(btrim(query)) = 'commit')
    `,
    [committingOnly]
  );
  return Number(rows[0]?.count ?? 0);
};

const toSqlLiteral = (value: string): string =>
  `'${value.replaceAll("'", "''")}'`;

const countCourseCompletions = async (courseId: string, userId: string) => {
  const { rows } = await getTestPool().query<{ count: string }>(
    "select count(*) from course_completions where course_id = $1 and user_id = $2",
    [courseId, userId]
  );
  return Number(rows[0]?.count ?? 0);
};

const countCertificates = async (courseId: string, userId: string) => {
  const { rows } = await getTestPool().query<{ count: string }>(
    "select count(*) from certificates where course_id = $1 and user_id = $2",
    [courseId, userId]
  );
  return Number(rows[0]?.count ?? 0);
};

const countCertificateRenderMessages = async (certificateId: string) => {
  const { rows } = await getTestPool().query<{ count: string }>(
    `
      select count(*)
      from outbox_messages
      where topic = 'certificate.render'
        and payload->>'certificateId' = $1
    `,
    [certificateId]
  );
  return Number(rows[0]?.count ?? 0);
};

describe("emissao concorrente de certificado", () => {
  beforeAll(() => {
    dependencies.getPool.mockReturnValue(pool);
    dependencies.resolveLessonAccess.mockResolvedValue(true);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    dependencies.resolveLessonAccess.mockResolvedValue(true);
    dependencies.createR2ObjectReadUrl.mockImplementation(
      async ({ key }: { key: string }) => `https://r2.test/${key}`
    );
    dependencies.renderCertificatePdf.mockResolvedValue({
      pdf: Buffer.from("stable-pdf"),
      sha256: "a".repeat(64),
    });
    storedCertificatePdf = null;
    dependencies.uploadPrivateR2ObjectIfAbsent.mockImplementation(
      storeCertificatePdfIfAbsent
    );
    vi.stubGlobal("fetch", vi.fn(fetchCertificateAsset));
    await pool.query("truncate table users cascade");
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("serializa duas aulas finais distintas antes da decisao de conclusao e emissao", async () => {
    const fixture = await createFixture({ withSecondRequiredLesson: true });

    if (!(fixture.secondLessonId && fixture.sequenceUnlockLessonId)) {
      throw new Error("Fixture concorrente sem as aulas finais esperadas.");
    }
    const pendingLessonIds = [fixture.lessonId, fixture.secondLessonId];
    await getTestPool().query(
      "insert into lesson_progress (user_id, lesson_id) values ($1, $2)",
      [fixture.userId, fixture.sequenceUnlockLessonId]
    );
    expect(await countLessonProgress(fixture.userId, pendingLessonIds)).toBe(0);
    expect(
      await countLessonProgress(fixture.userId, [
        fixture.sequenceUnlockLessonId,
      ])
    ).toBe(1);
    const suffix = randomUUID().replaceAll("-", "_");
    const gateFunction = `certificate_progress_gate_${suffix}`;
    const firstGateTrigger = `certificate_progress_first_${suffix}`;
    const secondGateTrigger = `certificate_progress_second_${suffix}`;
    const firstGateKey = `certificate-progress-first/${suffix}`;
    const secondGateKey = `certificate-progress-second/${suffix}`;
    const coordinator = await getTestPool().connect();
    let firstCompletion: ReturnType<typeof completeLesson> | null = null;
    let secondCompletion: ReturnType<typeof completeLesson> | null = null;
    try {
      await coordinator.query(
        `
          create function ${gateFunction}() returns trigger
          language plpgsql
          as $gate$
          begin
            perform pg_advisory_xact_lock_shared(hashtextextended(TG_ARGV[0], 0));
            return new;
          end;
          $gate$
        `
      );
      await coordinator.query(
        `
          create trigger ${firstGateTrigger}
          after insert on lesson_progress
          for each row
          when (
            new.user_id = ${toSqlLiteral(fixture.userId)}
            and new.lesson_id = ${toSqlLiteral(fixture.lessonId)}::uuid
          )
          execute function ${gateFunction}(${toSqlLiteral(firstGateKey)})
        `
      );
      await coordinator.query(
        `
          create constraint trigger ${secondGateTrigger}
          after insert on lesson_progress
          deferrable initially deferred
          for each row
          when (
            new.user_id = ${toSqlLiteral(fixture.userId)}
            and new.lesson_id = ${toSqlLiteral(fixture.secondLessonId)}::uuid
          )
          execute function ${gateFunction}(${toSqlLiteral(secondGateKey)})
        `
      );
      await coordinator.query(
        "select pg_advisory_lock(hashtextextended($1, 0))",
        [firstGateKey]
      );
      await coordinator.query(
        "select pg_advisory_lock(hashtextextended($1, 0))",
        [secondGateKey]
      );

      const waitingBaseline = await countWaitingAdvisoryLocks();
      const committingBaseline = await countWaitingAdvisoryLocks({
        committingOnly: true,
      });
      firstCompletion = completeLesson({
        lessonId: fixture.lessonId,
        userId: fixture.userId,
      });
      await vi.waitFor(
        async () => {
          expect(await countWaitingAdvisoryLocks()).toBe(waitingBaseline + 1);
        },
        { interval: 20, timeout: 5000 }
      );

      secondCompletion = completeLesson({
        lessonId: fixture.secondLessonId,
        userId: fixture.userId,
      });
      await vi.waitFor(
        async () => {
          expect(await countWaitingAdvisoryLocks()).toBe(waitingBaseline + 2);
        },
        { interval: 20, timeout: 5000 }
      );

      await coordinator.query(
        "select pg_advisory_unlock(hashtextextended($1, 0))",
        [firstGateKey]
      );
      await expect(firstCompletion).resolves.toMatchObject({
        certificateIssued: false,
      });
      await vi.waitFor(
        async () => {
          expect(
            await countWaitingAdvisoryLocks({ committingOnly: true })
          ).toBe(committingBaseline + 1);
        },
        { interval: 20, timeout: 5000 }
      );
      await coordinator.query(
        "select pg_advisory_unlock(hashtextextended($1, 0))",
        [secondGateKey]
      );
      await expect(secondCompletion).resolves.toMatchObject({
        certificateIssued: true,
      });
    } finally {
      await coordinator
        .query("select pg_advisory_unlock(hashtextextended($1, 0))", [
          firstGateKey,
        ])
        .catch(() => undefined);
      await coordinator
        .query("select pg_advisory_unlock(hashtextextended($1, 0))", [
          secondGateKey,
        ])
        .catch(() => undefined);
      await Promise.allSettled(
        [firstCompletion, secondCompletion].filter(
          (completion): completion is ReturnType<typeof completeLesson> =>
            completion !== null
        )
      );
      await coordinator
        .query(`drop trigger if exists ${firstGateTrigger} on lesson_progress`)
        .catch(() => undefined);
      await coordinator
        .query(`drop trigger if exists ${secondGateTrigger} on lesson_progress`)
        .catch(() => undefined);
      await coordinator
        .query(`drop function if exists ${gateFunction}()`)
        .catch(() => undefined);
      coordinator.release();
    }

    expect(await countCourseCompletions(fixture.courseId, fixture.userId)).toBe(
      1
    );
    expect(await countCertificates(fixture.courseId, fixture.userId)).toBe(1);

    const { rows } = await getTestPool().query<{ id: string }>(
      "select id from certificates where course_id = $1 and user_id = $2",
      [fixture.courseId, fixture.userId]
    );
    expect(await countCertificateRenderMessages(rows[0]?.id ?? "")).toBe(1);
  });

  it("retorna código somente para a transação que vence o conflito", async () => {
    const fixture = await createFixture();
    const testPool = getTestPool();
    const firstClient = await testPool.connect();
    const secondClient = await testPool.connect();
    try {
      await firstClient.query("begin");
      await secondClient.query("begin");
      const firstCode = await tryIssueAutomaticCompletionCertificate({
        client: firstClient,
        courseId: fixture.courseId,
        coursePublicationId: fixture.coursePublicationId,
        courseTitle: "Curso de concorrencia",
        studentName: "Aluna de concorrencia",
        userId: fixture.userId,
        workloadHours: 8,
      });
      const second = tryIssueAutomaticCompletionCertificate({
        client: secondClient,
        courseId: fixture.courseId,
        coursePublicationId: fixture.coursePublicationId,
        courseTitle: "Curso de concorrencia",
        studentName: "Aluna de concorrencia",
        userId: fixture.userId,
        workloadHours: 8,
      });

      await firstClient.query("commit");
      const secondCode = await second;
      await secondClient.query("commit");

      expect(firstCode).toMatch(AUTOMATIC_CERTIFICATE_CODE);
      expect(secondCode).toBeNull();
      expect(await countCertificates(fixture.courseId, fixture.userId)).toBe(1);
    } finally {
      await firstClient.query("rollback").catch(() => undefined);
      await secondClient.query("rollback").catch(() => undefined);
      firstClient.release();
      secondClient.release();
    }
  });

  it("permanece idempotente em retry e em callback de video duplicado", async () => {
    const fixture = await createFixture();

    await recordLessonWatchProgress({
      currentSeconds: 120,
      durationSeconds: 120,
      eventName: "ended",
      lessonId: fixture.lessonId,
      userId: fixture.userId,
    });
    await completeLesson({
      userId: fixture.userId,
      lessonId: fixture.lessonId,
    });
    await recordLessonWatchProgress({
      currentSeconds: 120,
      durationSeconds: 120,
      eventName: "ended",
      lessonId: fixture.lessonId,
      userId: fixture.userId,
    });

    expect(await countCertificates(fixture.courseId, fixture.userId)).toBe(1);
    const certificate = await getTestPool().query<{ id: string }>(
      "select id from certificates where course_id = $1 and user_id = $2",
      [fixture.courseId, fixture.userId]
    );
    expect(
      await countCertificateRenderMessages(certificate.rows[0]?.id ?? "")
    ).toBe(1);
  });

  it("nao emite automaticamente quando ja existe certificado valido ou revogado", async () => {
    const fixture = await createFixture();
    await getTestPool().query(
      `
        insert into certificates (
          user_id, course_id, course_publication_id, code,
          student_name_snapshot, course_title_snapshot,
          workload_hours_snapshot, status
        )
        values ($1, $2, $3, $4, 'Aluna de concorrencia', 'Curso de concorrencia', 8, $5)
      `,
      [
        fixture.userId,
        fixture.courseId,
        fixture.coursePublicationId,
        randomUUID(),
        "valid",
      ]
    );

    await expect(
      completeLesson({ userId: fixture.userId, lessonId: fixture.lessonId })
    ).resolves.toMatchObject({ certificateIssued: false });
    expect(await countCertificates(fixture.courseId, fixture.userId)).toBe(1);

    await getTestPool().query(
      "update certificates set status = 'revoked', revoked_at = now(), revoked_reason_category = 'other'"
    );
    await expect(
      completeLesson({ userId: fixture.userId, lessonId: fixture.lessonId })
    ).resolves.toMatchObject({ certificateIssued: false });
    expect(await countCertificates(fixture.courseId, fixture.userId)).toBe(1);
  });

  it("registra a renderizacao antes de confirmar o certificado", async () => {
    const fixture = await createFixture();

    await expect(
      completeLesson({ userId: fixture.userId, lessonId: fixture.lessonId })
    ).resolves.toMatchObject({ certificateIssued: true });
    expect(await countCertificates(fixture.courseId, fixture.userId)).toBe(1);
    const certificate = await getTestPool().query<{ id: string }>(
      "select id from certificates where course_id = $1 and user_id = $2",
      [fixture.courseId, fixture.userId]
    );
    expect(
      await countCertificateRenderMessages(certificate.rows[0]?.id ?? "")
    ).toBe(1);
  });

  it("reconcilia conclusao historica uma vez sob chamadas concorrentes e repetidas", async () => {
    const fixture = await createFixture();
    await getTestPool().query(
      `
        insert into course_completions (
          user_id, course_id, course_publication_id, completed_at
        )
        values ($1, $2, $3, now() - interval '1 day')
      `,
      [fixture.userId, fixture.courseId, fixture.coursePublicationId]
    );

    const concurrentResults = await Promise.all([
      reconcileHistoricalCourseCertificates({
        actorUserId: fixture.userId,
        courseId: fixture.courseId,
      }),
      reconcileHistoricalCourseCertificates({
        actorUserId: fixture.userId,
        courseId: fixture.courseId,
      }),
    ]);
    expect(
      concurrentResults.reduce((total, result) => total + result.issued, 0)
    ).toBe(1);
    expect(concurrentResults.every((result) => result.remaining === 0)).toBe(
      true
    );
    await expect(
      reconcileHistoricalCourseCertificates({
        actorUserId: fixture.userId,
        courseId: fixture.courseId,
      })
    ).resolves.toEqual({ issued: 0, remaining: 0 });

    expect(await countCertificates(fixture.courseId, fixture.userId)).toBe(1);
    const certificate = await getTestPool().query<{ id: string }>(
      "select id from certificates where course_id = $1 and user_id = $2",
      [fixture.courseId, fixture.userId]
    );
    expect(
      await countCertificateRenderMessages(certificate.rows[0]?.id ?? "")
    ).toBe(1);
  });

  it("preserva o predecessor ao revogar e reemitir com um unico certificado valido", async () => {
    const fixture = await createFixture();
    await completeLesson({
      lessonId: fixture.lessonId,
      userId: fixture.userId,
    });
    const initial = await getTestPool().query<{
      code: string;
      id: string;
      render_snapshot: unknown;
    }>(
      `select id, code, render_snapshot
       from certificates
       where course_id = $1 and user_id = $2`,
      [fixture.courseId, fixture.userId]
    );
    const predecessor = initial.rows[0];
    if (!predecessor) {
      throw new Error("Certificado predecessor nao foi emitido.");
    }

    await revokeCertificate({
      actorUserId: fixture.userId,
      certificateId: predecessor.id,
      reasonCategory: "identity_correction",
      reasonDetail: "Correcao controlada de identidade.",
    });
    const replacement = await reissueCertificate({
      actorUserId: fixture.userId,
      certificateId: predecessor.id,
      reasonCategory: "identity_correction",
      reasonDetail: "Reemissao controlada de identidade.",
    });

    const history = await getTestPool().query<{
      code: string;
      id: string;
      render_snapshot: unknown;
      replaces_certificate_id: string | null;
      status: "revoked" | "valid";
    }>(
      `select id, code, render_snapshot, replaces_certificate_id, status
       from certificates
       where course_id = $1 and user_id = $2
       order by issued_at, id`,
      [fixture.courseId, fixture.userId]
    );
    expect(history.rows).toHaveLength(2);
    expect(history.rows.filter((row) => row.status === "valid")).toHaveLength(
      1
    );
    expect(history.rows.find((row) => row.id === predecessor.id)).toMatchObject(
      {
        code: predecessor.code,
        render_snapshot: predecessor.render_snapshot,
        replaces_certificate_id: null,
        status: "revoked",
      }
    );
    expect(history.rows.find((row) => row.id === replacement.id)).toMatchObject(
      {
        replaces_certificate_id: predecessor.id,
        status: "valid",
      }
    );
    expect(await countCertificateRenderMessages(predecessor.id)).toBe(1);
    expect(await countCertificateRenderMessages(replacement.id)).toBe(1);
  });

  it("reprocessa renderizacao falha de pending ate ready", async () => {
    const fixture = await createFixture();
    await completeLesson({
      lessonId: fixture.lessonId,
      userId: fixture.userId,
    });
    const certificate = await getTestPool().query<{ id: string }>(
      "select id from certificates where course_id = $1 and user_id = $2",
      [fixture.courseId, fixture.userId]
    );
    const certificateId = certificate.rows[0]?.id;
    if (!certificateId) {
      throw new Error("Certificado pendente nao foi emitido.");
    }
    const worker = await getTestPool().connect();
    try {
      const [firstClaim] = await claimOutboxMessages({
        client: worker,
        limit: 1,
        workerId: "render-failure-worker",
      });
      expect(firstClaim?.aggregateId).toBe(certificateId);
      await expect(
        markOutboxMessageDeadLetter({
          client: worker,
          errorCode: "certificate_render_failed",
          id: String(firstClaim?.id),
          workerId: "render-failure-worker",
        })
      ).resolves.toBe(true);
      await expect(
        getTestPool().query<{ render_status: string }>(
          "select render_status from certificates where id = $1",
          [certificateId]
        )
      ).resolves.toMatchObject({ rows: [{ render_status: "failed" }] });

      await requeueDeadLetterMessage({
        actorUserId: fixture.userId,
        client: worker,
        messageId: String(firstClaim?.id),
        reason: "Recuperacao controlada da renderizacao.",
      });
      await expect(
        getTestPool().query<{ render_status: string }>(
          "select render_status from certificates where id = $1",
          [certificateId]
        )
      ).resolves.toMatchObject({ rows: [{ render_status: "pending" }] });

      const [retryClaim] = await claimOutboxMessages({
        client: worker,
        limit: 1,
        workerId: "render-retry-worker",
      });
      if (!retryClaim) {
        throw new Error(
          "Mensagem de renderizacao nao foi reclamada novamente."
        );
      }
      const retryWorkerId = "render-retry-worker";
      await expect(
        processClaimedOutboxMessage({
          deliver: deliverOutboxMessage,
          markDeadLetter: ({ errorCode, id }) =>
            markOutboxMessageDeadLetter({
              client: worker,
              errorCode,
              id,
              workerId: retryWorkerId,
            }),
          markDeferred: ({ errorCode, id }) =>
            markOutboxMessageDeferred({
              client: worker,
              errorCode,
              id,
              workerId: retryWorkerId,
            }),
          markDelivered: (id) =>
            markOutboxMessageDelivered({
              client: worker,
              id,
              workerId: retryWorkerId,
            }),
          markRetry: ({ errorCode, id, retryDelayMs }) =>
            markOutboxMessageForRetry({
              client: worker,
              errorCode,
              id,
              retryDelayMs,
              workerId: retryWorkerId,
            }),
          message: retryClaim,
        })
      ).resolves.toBe("delivered");
      await expect(
        getTestPool().query<{
          message_status: string;
          pdf_sha256: string | null;
          render_status: string;
        }>(
          `select certificate.pdf_sha256,
                  certificate.render_status,
                  message.status as message_status
           from certificates as certificate
           join outbox_messages as message on message.id = $2
           where certificate.id = $1`,
          [certificateId, retryClaim.id]
        )
      ).resolves.toMatchObject({
        rows: [
          {
            message_status: "delivered",
            pdf_sha256: expect.stringMatching(SHA256_PATTERN),
            render_status: "ready",
          },
        ],
      });
    } finally {
      worker.release();
    }
  });

  it(
    "mantem a unicidade em vinte corridas consecutivas",
    async () => {
      for (let index = 0; index < CONSECUTIVE_ISSUANCE_RUNS; index += 1) {
        const fixture = await createFixture();
        const results = await Promise.all([
          completeLesson({
            userId: fixture.userId,
            lessonId: fixture.lessonId,
          }),
          completeLesson({
            userId: fixture.userId,
            lessonId: fixture.lessonId,
          }),
        ]);

        expect(
          results.filter((result) => result.certificateIssued)
        ).toHaveLength(1);
        expect(await countCertificates(fixture.courseId, fixture.userId)).toBe(
          1
        );
      }
    },
    CONSECUTIVE_ISSUANCE_TIMEOUT_MS
  );
});

const createPendingRender = async (): Promise<string> => {
  const fixture = await createFixture();
  await completeLesson({ userId: fixture.userId, lessonId: fixture.lessonId });
  const result = await pool.query<{ id: string }>(
    "select id from certificates where course_id = $1 and user_id = $2",
    [fixture.courseId, fixture.userId]
  );
  const certificateId = result.rows[0]?.id;
  if (!certificateId) {
    throw new Error("Nao foi possivel criar o certificado pendente de teste.");
  }
  return certificateId;
};

describe("claim persistido de renderizacao", () => {
  beforeAll(() => {
    dependencies.getPool.mockReturnValue(pool);
    dependencies.resolveLessonAccess.mockResolvedValue(true);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    dependencies.resolveLessonAccess.mockResolvedValue(true);
    dependencies.createR2ObjectReadUrl.mockImplementation(
      async ({ key }: { key: string }) => `https://r2.test/${key}`
    );
    dependencies.renderCertificatePdf.mockResolvedValue({
      pdf: Buffer.from("stable-pdf"),
      sha256: "a".repeat(64),
    });
    storedCertificatePdf = null;
    dependencies.uploadPrivateR2ObjectIfAbsent.mockImplementation(
      storeCertificatePdfIfAbsent
    );
    vi.stubGlobal("fetch", vi.fn(fetchCertificateAsset));
    await pool.query("truncate table users cascade");
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await pool.end();
  });

  it("permite somente um renderizador durante o lease ativo", async () => {
    const certificateId = await createPendingRender();
    let finishRender!: (value: { pdf: Buffer; sha256: string }) => void;
    dependencies.renderCertificatePdf.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRender = resolve;
        })
    );

    const first = renderPendingCertificate(certificateId);
    await vi.waitFor(() => {
      expect(dependencies.renderCertificatePdf).toHaveBeenCalledOnce();
    });

    await expect(renderPendingCertificate(certificateId)).rejects.toThrow(
      "certificate_render_in_progress"
    );
    finishRender({ pdf: Buffer.from("stable-pdf"), sha256: "a".repeat(64) });
    await expect(first).resolves.toBe(true);

    expect(dependencies.uploadPrivateR2ObjectIfAbsent).toHaveBeenCalledOnce();
  });

  it("retoma um claim cujo lease expirou", async () => {
    const certificateId = await createPendingRender();
    await pool.query(
      `update certificates
       set render_claim_token = $2,
           render_claimed_at = now() - interval '11 minutes'
       where id = $1`,
      [certificateId, randomUUID()]
    );

    await expect(renderPendingCertificate(certificateId)).resolves.toBe(true);

    const result = await pool.query<{
      render_claim_token: string | null;
      render_status: string;
    }>(
      "select render_claim_token, render_status from certificates where id = $1",
      [certificateId]
    );
    expect(result.rows[0]).toEqual({
      render_claim_token: null,
      render_status: "ready",
    });
  });

  it("libera o claim depois de uma falha recuperavel", async () => {
    const certificateId = await createPendingRender();
    dependencies.uploadPrivateR2ObjectIfAbsent.mockRejectedValueOnce(
      new Error("r2_unavailable")
    );

    await expect(renderPendingCertificate(certificateId)).rejects.toThrow(
      "r2_unavailable"
    );

    const result = await pool.query<{
      render_claim_token: string | null;
      render_status: string;
    }>(
      "select render_claim_token, render_status from certificates where id = $1",
      [certificateId]
    );
    expect(result.rows[0]).toEqual({
      render_claim_token: null,
      render_status: "pending",
    });
  });

  it("finaliza o artefato ja enviado depois de um crash sem novo render", async () => {
    const certificateId = await createPendingRender();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(Buffer.from("existing-pdf")))
    );

    await expect(renderPendingCertificate(certificateId)).resolves.toBe(true);

    expect(dependencies.renderCertificatePdf).not.toHaveBeenCalled();
    expect(dependencies.uploadPrivateR2ObjectIfAbsent).not.toHaveBeenCalled();
    const result = await pool.query<{
      pdf_sha256: string;
      render_status: string;
    }>("select pdf_sha256, render_status from certificates where id = $1", [
      certificateId,
    ]);
    expect(result.rows[0]?.render_status).toBe("ready");
    expect(result.rows[0]?.pdf_sha256).toMatch(SHA256_PATTERN);
  });

  it("nao finaliza nem enfileira email quando e revogado durante o IO", async () => {
    const certificateId = await createPendingRender();
    let finishRender!: (value: { pdf: Buffer; sha256: string }) => void;
    dependencies.renderCertificatePdf.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRender = resolve;
        })
    );
    const delivery = deliverOutboxMessage({
      aggregateId: certificateId,
      aggregateType: "certificate",
      attempts: 1,
      id: randomUUID(),
      idempotencyKey: `certificate.render/${certificateId}/v1`,
      payload: { certificateId },
      payloadVersion: 1,
      topic: "certificate.render",
    });
    await vi.waitFor(() => {
      expect(dependencies.renderCertificatePdf).toHaveBeenCalledOnce();
    });
    await pool.query(
      "update certificates set status = 'revoked', revoked_at = now(), revoked_reason_category = 'other' where id = $1",
      [certificateId]
    );

    finishRender({ pdf: Buffer.from("revoked-pdf"), sha256: "c".repeat(64) });
    await expect(delivery).rejects.toMatchObject({
      code: "aggregate_not_deliverable",
    });

    const result = await pool.query<{
      email_count: string;
      pdf_storage_key: string | null;
      render_claim_token: string | null;
      render_status: string;
    }>(
      `select
         certificate.pdf_storage_key,
         certificate.render_claim_token,
         certificate.render_status,
         count(message.id)::text as email_count
       from certificates as certificate
       left join outbox_messages as message
         on message.idempotency_key = 'email.certificate-issued/' || certificate.id || '/v1'
       where certificate.id = $1
       group by certificate.id`,
      [certificateId]
    );
    expect(result.rows[0]).toEqual({
      email_count: "0",
      pdf_storage_key: null,
      render_claim_token: null,
      render_status: "pending",
    });
  });

  it("impede o token antigo de completar depois que outro worker assume o lease", async () => {
    const certificateId = await createPendingRender();
    const workerAPdf = Buffer.from("worker-a");
    const workerBPdf = Buffer.from("worker-b");
    const workerAHash = createHash("sha256").update(workerAPdf).digest("hex");
    const workerBHash = createHash("sha256").update(workerBPdf).digest("hex");
    let finishFirst!: (value: { pdf: Buffer; sha256: string }) => void;
    dependencies.renderCertificatePdf
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = resolve;
          })
      )
      .mockResolvedValueOnce({
        pdf: workerBPdf,
        sha256: workerBHash,
      });

    const workerA = renderPendingCertificate(certificateId);
    await vi.waitFor(() => {
      expect(dependencies.renderCertificatePdf).toHaveBeenCalledOnce();
    });
    await pool.query(
      "update certificates set render_claimed_at = now() - interval '11 minutes' where id = $1",
      [certificateId]
    );

    await expect(renderPendingCertificate(certificateId)).resolves.toBe(true);
    finishFirst({ pdf: workerAPdf, sha256: workerAHash });
    await expect(workerA).resolves.toBe(true);

    const result = await pool.query<{
      pdf_sha256: string;
      render_status: string;
    }>("select pdf_sha256, render_status from certificates where id = $1", [
      certificateId,
    ]);
    expect(result.rows[0]).toEqual({
      pdf_sha256: workerBHash,
      render_status: "ready",
    });
    expect(storedCertificatePdf).toEqual(workerBPdf);
    expect(
      createHash("sha256")
        .update(storedCertificatePdf ?? Buffer.alloc(0))
        .digest("hex")
    ).toBe(result.rows[0]?.pdf_sha256);
  });
});
