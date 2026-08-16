import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import {
  type CertificateReasonCode,
  parseCertificateReasonCode,
} from "@/features/certificates/reasons";
import {
  parseCertificateRenderSnapshot,
  parseCertificateTemplateDraft,
} from "@/features/certificates/render-snapshot";
import { renderCertificatePdf } from "@/features/certificates/rendering";
import {
  CERTIFICATE_RENDER_CLAIM_LEASE_MINUTES,
  createCertificateCode,
} from "@/features/certificates/rules";
import { createCertificateRenderMessage } from "@/features/outbox/rules";
import { enqueueOutboxMessage } from "@/features/outbox/server";
import {
  createR2ObjectReadUrl,
  uploadPrivateR2ObjectIfAbsent,
} from "@/features/storage/r2";
import { getServerEnv } from "@/lib/env";
import { CertificateDomainError } from "./errors";

const MAX_CERTIFICATE_CODE_ATTEMPTS = 3;
const CERTIFICATE_CODE_GENERATION_ERROR =
  "Nao foi possivel gerar um codigo publico unico.";

const isCertificateCodeCollision = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; constraint?: unknown };
  return (
    candidate.code === "23505" &&
    candidate.constraint === "certificates_code_unique"
  );
};

const lockCertificatePair = async (
  client: PoolClient,
  userId: string,
  courseId: string
): Promise<void> => {
  await client.query(
    "select pg_advisory_xact_lock(hashtextextended($1 || ':' || $2, 0))",
    [userId, courseId]
  );
};

export interface CertificateRecord {
  code: string;
  completionAt?: Date | null;
  courseTitle: string;
  issuedAt: Date;
  issuerCnpj?: string | null;
  issuerName?: string | null;
  renderStatus: "failed" | "pending" | "ready";
  revokedAt: Date | null;
  revokedReasonCategory: CertificateReasonCode | null;
  status: "revoked" | "valid";
  studentName: string;
  workloadHours: number;
}

const parseSnapshotDate = (value: string | null): Date | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const tryIssueAutomaticCompletionCertificate = async ({
  client,
  courseId,
  coursePublicationId,
  courseTitle,
  completedAt = new Date(),
  studentName,
  userId,
  workloadHours,
}: {
  client: PoolClient;
  courseId: string;
  coursePublicationId: string;
  courseTitle: string;
  completedAt?: Date;
  studentName: string;
  userId: string;
  workloadHours: number;
}): Promise<string | null> => {
  await lockCertificatePair(client, userId, courseId);
  const template = await client.query<{
    id: string;
    version: number;
    background_key: string;
    signer_name: string | null;
    signer_role: string | null;
    signature_key: string | null;
    spec: unknown;
    issuer_cnpj: string;
    issuer_display_name: string;
    issuer_legal_name: string;
  }>(
    `
       select ct.id, ct.version, ct.background_key, ct.spec,
              coalesce(ct.signer_name, settings.certificate_signer_name) as signer_name,
             coalesce(ct.signer_role, settings.certificate_signer_role) as signer_role,
             ct.signature_key,
              issuer.cnpj as issuer_cnpj, issuer.legal_name as issuer_legal_name,
              issuer.display_name as issuer_display_name
      from courses c
      join certificate_templates ct on ct.course_id = c.id and ct.status = 'published'
      join certificate_issuer_profiles issuer on issuer.id = 'global'
      left join app_settings settings on settings.id = 'global'
      where c.id = $1 and c.certificate_enabled = true
      limit 1
    `,
    [courseId]
  );
  const templateSnapshot = template.rows[0];
  if (!templateSnapshot) {
    return null;
  }
  const issuedAt = new Date().toISOString();
  const completionAt = completedAt.toISOString();
  const templateFields = parseCertificateTemplateDraft(
    templateSnapshot.spec
  ).fields;

  for (let attempt = 0; attempt < MAX_CERTIFICATE_CODE_ATTEMPTS; attempt += 1) {
    const savepoint = `certificate_code_attempt_${attempt}`;
    await client.query(`savepoint ${savepoint}`);
    const candidateCode = createCertificateCode(randomUUID());
    const renderSnapshot = parseCertificateRenderSnapshot({
      certificate: { code: candidateCode, issuedAt },
      completion: { completedAt: completionAt },
      course: { title: courseTitle, workloadHours },
      issuer: {
        cnpj: templateSnapshot.issuer_cnpj,
        displayName: templateSnapshot.issuer_display_name,
        legalName: templateSnapshot.issuer_legal_name,
      },
      student: { name: studentName },
      template: {
        backgroundKey: templateSnapshot.background_key,
        fields: templateFields,
        id: templateSnapshot.id,
        signatureKey: templateSnapshot.signature_key,
        signerName: templateSnapshot.signer_name,
        signerRole: templateSnapshot.signer_role,
        version: templateSnapshot.version,
      },
      version: 1,
    });

    try {
      const certificate = await client.query<{ code: string }>(
        `
          insert into certificates (
            user_id,
            course_id,
            course_publication_id,
            code,
            student_name_snapshot,
            course_title_snapshot,
            workload_hours_snapshot,
            certificate_template_id,
            render_snapshot
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
          on conflict (user_id, course_id) where status = 'valid' do nothing
          returning code
        `,
        [
          userId,
          courseId,
          coursePublicationId,
          candidateCode,
          studentName,
          courseTitle,
          workloadHours,
          templateSnapshot.id,
          JSON.stringify(renderSnapshot),
        ]
      );
      await client.query(`release savepoint ${savepoint}`);
      return certificate.rows[0]?.code ?? null;
    } catch (error) {
      await client.query(`rollback to savepoint ${savepoint}`);
      await client.query(`release savepoint ${savepoint}`);
      if (isCertificateCodeCollision(error)) {
        if (attempt + 1 < MAX_CERTIFICATE_CODE_ATTEMPTS) {
          continue;
        }
        throw new CertificateDomainError(CERTIFICATE_CODE_GENERATION_ERROR);
      }
      throw error;
    }
  }

  throw new CertificateDomainError(CERTIFICATE_CODE_GENERATION_ERROR);
};

export interface CompletionCertificateSummary {
  certificateId: string | null;
  completedLessons: number;
  courseTitle: string;
  studentName: string;
  totalLessons: number;
  workloadHours: number;
}

export const issueCompletionCertificateIfEligible = async ({
  client,
  courseId,
  coursePublicationId,
  summary,
  userId,
}: {
  client: PoolClient;
  courseId: string;
  coursePublicationId: string;
  summary: CompletionCertificateSummary;
  userId: string;
}): Promise<boolean> => {
  const isEligible =
    summary.totalLessons > 0 &&
    summary.completedLessons >= summary.totalLessons &&
    !summary.certificateId;

  if (!isEligible) {
    return false;
  }

  await lockCertificatePair(client, userId, courseId);
  const completion = await client.query<{ completed_at: Date; id: string }>(
    `
      insert into course_completions as completion (user_id, course_id, course_publication_id)
      values ($1, $2, $3)
      on conflict (user_id, course_id) do update
      set completed_at = completion.completed_at
      returning id, completed_at
    `,
    [userId, courseId, coursePublicationId]
  );

  if (!completion.rows[0]) {
    return false;
  }

  const certificateCode = await tryIssueAutomaticCompletionCertificate({
    client,
    courseId,
    coursePublicationId,
    courseTitle: summary.courseTitle,
    completedAt: completion.rows[0].completed_at,
    studentName: summary.studentName,
    userId,
    workloadHours: summary.workloadHours,
  });

  if (!certificateCode) {
    return false;
  }

  const certificate = await client.query<{ id: string }>(
    `
      select id
      from certificates
      where code = $1
      limit 1
    `,
    [certificateCode]
  );
  const certificateId = certificate.rows[0]?.id;

  if (!certificateId) {
    throw new CertificateDomainError(
      "Certificado emitido sem identificador persistido."
    );
  }

  await enqueueOutboxMessage({
    client,
    message: createCertificateRenderMessage({ certificateId }),
  });

  return true;
};

const auditCertificate = async ({
  action,
  actorUserId,
  certificateId,
  client,
  metadata = {},
}: {
  action: string;
  actorUserId: string;
  certificateId: string;
  client: PoolClient;
  metadata?: Record<string, string>;
}): Promise<void> => {
  await client.query(
    `
      insert into audit_logs (actor_user_id, action, target_type, target_id, metadata)
      values ($1, $2, 'certificate', $3, $4::jsonb)
    `,
    [actorUserId, action, certificateId, JSON.stringify(metadata)]
  );
};

const requireCertificateReason = ({
  reasonCategory,
  reasonDetail,
}: {
  reasonCategory: string;
  reasonDetail: string;
}): CertificateReasonCode => {
  const category = parseCertificateReasonCode(reasonCategory);

  if (!(category && reasonDetail.trim())) {
    throw new CertificateDomainError(
      "Informe a categoria e o detalhe interno do motivo."
    );
  }

  return category;
};

const issueCertificate = async ({
  actorUserId,
  client,
  courseId,
  coursePublicationId,
  reasonCategory,
  reasonDetail,
  replacesCertificateId,
  userId,
}: {
  actorUserId: string;
  client: PoolClient;
  courseId: string;
  coursePublicationId: string;
  reasonCategory?: CertificateReasonCode;
  reasonDetail?: string;
  replacesCertificateId?: string;
  userId: string;
}): Promise<{ id: string }> => {
  const snapshot = await client.query<{
    completed_at: Date;
    course_title: string;
    student_name: string;
    workload_hours: number;
    template_id: string;
    template_version: number;
    background_key: string;
    signer_name: string | null;
    signer_role: string | null;
    signature_key: string | null;
    spec: unknown;
    issuer_cnpj: string;
    issuer_display_name: string;
    issuer_legal_name: string;
  }>(
    `
      select
        u.name as student_name,
        cc.completed_at,
        cp.title_snapshot as course_title,
        coalesce(c.workload_hours_override, cp.workload_hours_snapshot) as workload_hours,
        ct.id as template_id,
        ct.version as template_version,
        ct.background_key,
        ct.spec,
        coalesce(ct.signer_name, settings.certificate_signer_name) as signer_name,
        coalesce(ct.signer_role, settings.certificate_signer_role) as signer_role,
        ct.signature_key,
        issuer.cnpj as issuer_cnpj,
        issuer.legal_name as issuer_legal_name,
        issuer.display_name as issuer_display_name
      from users u
      join course_publications cp on cp.course_id = $2 and cp.id = $3
      join courses c on c.id = cp.course_id and c.certificate_enabled = true
      join course_completions cc
        on cc.user_id = u.id
       and cc.course_id = c.id
       and cc.course_publication_id = cp.id
      join certificate_templates ct on ct.course_id = c.id and ct.status = 'published'
      join certificate_issuer_profiles issuer on issuer.id = 'global'
      left join app_settings settings on settings.id = 'global'
      where u.id = $1
      limit 1
    `,
    [userId, courseId, coursePublicationId]
  );
  const source = snapshot.rows[0];

  if (!source) {
    throw new CertificateDomainError("Aluna ou curso nao localizado.");
  }

  const issuedAt = new Date().toISOString();
  const templateFields = parseCertificateTemplateDraft(source.spec).fields;
  let certificateId: string | undefined;

  for (let attempt = 0; attempt < MAX_CERTIFICATE_CODE_ATTEMPTS; attempt += 1) {
    const savepoint = `certificate_code_attempt_${attempt}`;
    await client.query(`savepoint ${savepoint}`);
    const certificateCode = createCertificateCode(randomUUID());
    const renderSnapshot = parseCertificateRenderSnapshot({
      certificate: { code: certificateCode, issuedAt },
      completion: { completedAt: source.completed_at.toISOString() },
      course: {
        title: source.course_title,
        workloadHours: source.workload_hours,
      },
      issuer: {
        cnpj: source.issuer_cnpj,
        displayName: source.issuer_display_name,
        legalName: source.issuer_legal_name,
      },
      student: { name: source.student_name },
      template: {
        backgroundKey: source.background_key,
        fields: templateFields,
        id: source.template_id,
        signatureKey: source.signature_key,
        signerName: source.signer_name,
        signerRole: source.signer_role,
        version: source.template_version,
      },
      version: 1,
    });

    try {
      const certificate = await client.query<{ id: string }>(
        `
          insert into certificates (
            user_id,
            course_id,
            course_publication_id,
            code,
            student_name_snapshot,
            course_title_snapshot,
            workload_hours_snapshot,
            replaces_certificate_id,
            certificate_template_id,
            render_snapshot
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
          returning id
        `,
        [
          userId,
          courseId,
          coursePublicationId,
          certificateCode,
          source.student_name,
          source.course_title,
          source.workload_hours,
          replacesCertificateId ?? null,
          source.template_id,
          JSON.stringify(renderSnapshot),
        ]
      );
      await client.query(`release savepoint ${savepoint}`);
      certificateId = certificate.rows[0]?.id;
      break;
    } catch (error) {
      await client.query(`rollback to savepoint ${savepoint}`);
      await client.query(`release savepoint ${savepoint}`);
      if (isCertificateCodeCollision(error)) {
        if (attempt + 1 < MAX_CERTIFICATE_CODE_ATTEMPTS) {
          continue;
        }
        throw new CertificateDomainError(CERTIFICATE_CODE_GENERATION_ERROR);
      }
      throw error;
    }
  }

  if (!certificateId) {
    throw new CertificateDomainError("Nao foi possivel emitir o certificado.");
  }

  await auditCertificate({
    action: replacesCertificateId
      ? "certificate.reissued"
      : "certificate.issued",
    actorUserId,
    certificateId,
    client,
    metadata: reasonCategory
      ? {
          reasonCategory,
          reasonDetail: reasonDetail ?? "",
        }
      : {},
  });
  await enqueueOutboxMessage({
    client,
    message: createCertificateRenderMessage({ certificateId }),
  });
  return { id: certificateId };
};

export const issueManualCertificate = async ({
  actorUserId,
  courseId,
  reasonCategory,
  reasonDetail,
  userId,
}: {
  actorUserId: string;
  courseId: string;
  reasonCategory: string;
  reasonDetail: string;
  userId: string;
}): Promise<{ id: string }> => {
  const category = requireCertificateReason({ reasonCategory, reasonDetail });

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await lockCertificatePair(client, userId, courseId);
    const enrollment = await client.query<{ id: string }>(
      `
        select id
        from enrollments
        where user_id = $1 and course_id = $2
        limit 1
      `,
      [userId, courseId]
    );
    if (!enrollment.rows[0]) {
      throw new CertificateDomainError(
        "A aluna nao possui matricula no curso."
      );
    }
    const certificateHistory = await client.query<{
      id: string;
      status: "revoked" | "valid";
    }>(
      `
        select id, status
        from certificates
        where user_id = $1 and course_id = $2
        order by issued_at desc, id desc
        limit 1
        for update
      `,
      [userId, courseId]
    );
    const existingCertificate = certificateHistory.rows[0];
    if (existingCertificate?.status === "valid") {
      throw new CertificateDomainError(
        "A aluna ja possui um certificado valido para este curso."
      );
    }
    if (existingCertificate?.status === "revoked") {
      throw new CertificateDomainError(
        "Use a reemissao para substituir um certificado historico revogado."
      );
    }
    const publication = await client.query<{ id: string }>(
      `
        select id
        from course_publications
        where course_id = $1 and status = 'published'
        limit 1
      `,
      [courseId]
    );
    const publishedCoursePublicationId = publication.rows[0]?.id;
    if (!publishedCoursePublicationId) {
      throw new CertificateDomainError("Curso sem publicacao vigente.");
    }
    await client.query(
      `
        insert into course_completions (user_id, course_id, course_publication_id)
        values ($1, $2, $3)
        on conflict (user_id, course_id) do nothing
      `,
      [userId, courseId, publishedCoursePublicationId]
    );
    const completion = await client.query<{ course_publication_id: string }>(
      `
        select course_publication_id
        from course_completions
        where user_id = $1 and course_id = $2
        limit 1
      `,
      [userId, courseId]
    );
    const coursePublicationId = completion.rows[0]?.course_publication_id;
    if (!coursePublicationId) {
      throw new CertificateDomainError("Conclusao do curso nao localizada.");
    }
    const certificate = await issueCertificate({
      actorUserId,
      client,
      courseId,
      coursePublicationId,
      reasonCategory: category,
      reasonDetail: reasonDetail.trim(),
      userId,
    });
    await client.query("commit");
    return certificate;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const revokeCertificate = async ({
  actorUserId,
  certificateId,
  reasonCategory,
  reasonDetail,
}: {
  actorUserId: string;
  certificateId: string;
  reasonCategory: string;
  reasonDetail: string;
}): Promise<void> => {
  const category = requireCertificateReason({ reasonCategory, reasonDetail });

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{ id: string }>(
      `
        update certificates
        set status = 'revoked',
            revoked_at = now(),
            revoked_reason_category = $2,
            revoked_reason = $3,
            revoked_by_user_id = $4,
            updated_at = now()
        where id = $1
          and status = 'valid'
        returning id
      `,
      [certificateId, category, reasonDetail.trim(), actorUserId]
    );

    if (!result.rows[0]) {
      throw new CertificateDomainError("Certificado invalido ou ja revogado.");
    }

    await auditCertificate({
      action: "certificate.revoked",
      actorUserId,
      certificateId,
      client,
      metadata: { reasonCategory: category, reasonDetail: reasonDetail.trim() },
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const reissueCertificate = async ({
  actorUserId,
  certificateId,
  reasonCategory,
  reasonDetail,
}: {
  actorUserId: string;
  certificateId: string;
  reasonCategory: string;
  reasonDetail: string;
}): Promise<{ id: string }> => {
  const category = requireCertificateReason({ reasonCategory, reasonDetail });

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const previousResult = await client.query<{
      course_id: string;
      course_publication_id: string;
      id: string;
      status: "revoked" | "valid";
      user_id: string;
    }>(
      `
        select id, user_id, course_id, course_publication_id, status
        from certificates
        where id = $1
      `,
      [certificateId]
    );
    const previousCertificate = previousResult.rows[0];

    if (!previousCertificate) {
      throw new CertificateDomainError("Certificado nao localizado.");
    }

    await lockCertificatePair(
      client,
      previousCertificate.user_id,
      previousCertificate.course_id
    );

    const lockedPreviousResult = await client.query<{
      course_id: string;
      course_publication_id: string;
      id: string;
      status: "revoked" | "valid";
      user_id: string;
    }>(
      `
        select id, user_id, course_id, course_publication_id, status
        from certificates
        where id = $1
        for update
      `,
      [certificateId]
    );
    const lockedPreviousCertificate = lockedPreviousResult.rows[0];

    if (!lockedPreviousCertificate) {
      throw new CertificateDomainError("Certificado nao localizado.");
    }

    const latest = await client.query<{
      id: string;
      status: "revoked" | "valid";
    }>(
      `
        select id, status
        from certificates
        where user_id = $1 and course_id = $2
        order by issued_at desc, id desc
        limit 1
        for update
      `,
      [lockedPreviousCertificate.user_id, lockedPreviousCertificate.course_id]
    );
    if (latest.rows[0]?.id !== lockedPreviousCertificate.id) {
      throw new CertificateDomainError(
        "Somente o certificado historico mais recente pode ser reemitido."
      );
    }

    if (lockedPreviousCertificate.status === "valid") {
      const revoked = await client.query<{ id: string }>(
        `
          update certificates
          set status = 'revoked',
              revoked_at = now(),
              revoked_reason_category = $2,
              revoked_reason = $3,
              revoked_by_user_id = $4,
              updated_at = now()
          where id = $1
            and status = 'valid'
          returning id
        `,
        [
          lockedPreviousCertificate.id,
          category,
          reasonDetail.trim(),
          actorUserId,
        ]
      );

      if (!revoked.rows[0]) {
        throw new CertificateDomainError(
          "Certificado invalido ou ja revogado."
        );
      }

      await auditCertificate({
        action: "certificate.revoked_for_reissue",
        actorUserId,
        certificateId,
        client,
        metadata: {
          reasonCategory: category,
          reasonDetail: reasonDetail.trim(),
        },
      });
    }
    const replacement = await issueCertificate({
      actorUserId,
      client,
      courseId: lockedPreviousCertificate.course_id,
      coursePublicationId: lockedPreviousCertificate.course_publication_id,
      reasonCategory: category,
      reasonDetail: reasonDetail.trim(),
      replacesCertificateId: certificateId,
      userId: lockedPreviousCertificate.user_id,
    });
    await client.query("commit");
    return replacement;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const getCertificateByCode = async (
  code: string
): Promise<CertificateRecord | null> => {
  const { rows } = await getPool().query<{
    code: string;
    completion_at_snapshot: string | null;
    student_name_snapshot: string;
    course_title_snapshot: string;
    workload_hours_snapshot: number;
    issued_at: Date;
    issuer_cnpj_snapshot: string | null;
    issuer_name_snapshot: string | null;
    revoked_at: Date | null;
    revoked_reason_category: string | null;
    status: "revoked" | "valid";
    render_status: "failed" | "pending" | "ready";
  }>(
    `
      select
        code,
        render_snapshot->'completion'->>'completedAt' as completion_at_snapshot,
        student_name_snapshot,
        course_title_snapshot,
        workload_hours_snapshot,
        issued_at,
        render_snapshot->'issuer'->>'cnpj' as issuer_cnpj_snapshot,
        render_snapshot->'issuer'->>'displayName' as issuer_name_snapshot,
        revoked_at,
        revoked_reason_category,
        render_status,
        status
      from certificates
      where code = $1
      limit 1
    `,
    [code]
  );
  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    code: row.code,
    completionAt: parseSnapshotDate(row.completion_at_snapshot),
    studentName: row.student_name_snapshot,
    courseTitle: row.course_title_snapshot,
    workloadHours: row.workload_hours_snapshot,
    issuedAt: row.issued_at,
    issuerCnpj: row.issuer_cnpj_snapshot,
    issuerName: row.issuer_name_snapshot,
    revokedAt: row.revoked_at,
    revokedReasonCategory:
      parseCertificateReasonCode(row.revoked_reason_category) ??
      (row.status === "revoked" ? "other" : null),
    renderStatus: row.render_status,
    status: row.status,
  };
};

export const getCertificatesForUser = async (
  userId: string
): Promise<CertificateRecord[]> => {
  const { rows } = await getPool().query<{
    code: string;
    student_name_snapshot: string;
    course_title_snapshot: string;
    workload_hours_snapshot: number;
    issued_at: Date;
    revoked_at: Date | null;
    revoked_reason_category: string | null;
    status: "revoked" | "valid";
    render_status: "failed" | "pending" | "ready";
  }>(
    `
      select
        code,
        student_name_snapshot,
        course_title_snapshot,
        workload_hours_snapshot,
        issued_at,
        revoked_at,
        revoked_reason_category,
        render_status,
        status
      from certificates
      where user_id = $1
      order by issued_at desc
    `,
    [userId]
  );

  return rows.map((row) => ({
    code: row.code,
    studentName: row.student_name_snapshot,
    courseTitle: row.course_title_snapshot,
    workloadHours: row.workload_hours_snapshot,
    issuedAt: row.issued_at,
    revokedAt: row.revoked_at,
    revokedReasonCategory:
      parseCertificateReasonCode(row.revoked_reason_category) ??
      (row.status === "revoked" ? "other" : null),
    renderStatus: row.render_status,
    status: row.status,
  }));
};

export interface CertificateOperationRecord extends CertificateRecord {
  canReissue: boolean;
  id: string;
}

export const getCertificateOperationsForUser = async (
  userId: string
): Promise<CertificateOperationRecord[]> => {
  const { rows } = await getPool().query<{
    code: string;
    can_reissue: boolean;
    course_id: string;
    course_title_snapshot: string;
    id: string;
    issued_at: Date;
    revoked_at: Date | null;
    revoked_reason_category: string | null;
    status: "revoked" | "valid";
    render_status: "failed" | "pending" | "ready";
    student_name_snapshot: string;
    workload_hours_snapshot: number;
  }>(
    `
      select certificate.id, certificate.code, certificate.student_name_snapshot,
             certificate.course_title_snapshot, certificate.workload_hours_snapshot,
             certificate.issued_at, certificate.revoked_at,
             certificate.revoked_reason_category, certificate.status,
             certificate.render_status,
             not exists (
               select 1
               from certificates newer
               where newer.user_id = certificate.user_id
                 and newer.course_id = certificate.course_id
                 and (
                   newer.issued_at > certificate.issued_at
                   or (newer.issued_at = certificate.issued_at and newer.id > certificate.id)
                 )
             ) as can_reissue
      from certificates certificate
      where certificate.user_id = $1
      order by certificate.issued_at desc, certificate.id desc
    `,
    [userId]
  );

  return rows.map((row) => ({
    canReissue: row.can_reissue,
    code: row.code,
    courseTitle: row.course_title_snapshot,
    id: row.id,
    issuedAt: row.issued_at,
    revokedAt: row.revoked_at,
    revokedReasonCategory:
      parseCertificateReasonCode(row.revoked_reason_category) ??
      (row.status === "revoked" ? "other" : null),
    renderStatus: row.render_status,
    status: row.status,
    studentName: row.student_name_snapshot,
    workloadHours: row.workload_hours_snapshot,
  }));
};

export const renderPendingCertificate = async (
  certificateId: string
): Promise<boolean> => {
  const claimToken = randomUUID();
  const pool = getPool();
  const releaseClaim = async (): Promise<void> => {
    await pool.query(
      `update certificates
       set render_claim_token = null,
           render_claimed_at = null,
           updated_at = now()
       where id = $1
         and render_status = 'pending'
         and render_claim_token = $2`,
      [certificateId, claimToken]
    );
  };
  const claim = await pool.query<{
    pdf_sha256: string | null;
    render_snapshot: unknown;
  }>(
    `update certificates
     set render_claim_token = $2,
         render_claimed_at = now(),
         updated_at = now()
     where id = $1
       and status = 'valid'
       and render_status = 'pending'
       and (
         render_claim_token is null
         or render_claimed_at < now() - ($3 * interval '1 minute')
       )
       returning render_snapshot, pdf_sha256`,
    [certificateId, claimToken, CERTIFICATE_RENDER_CLAIM_LEASE_MINUTES]
  );
  const certificate = claim.rows[0];

  if (!certificate) {
    const state = await pool.query<{
      render_status: "failed" | "pending" | "ready";
      status: "revoked" | "valid";
    }>("select render_status, status from certificates where id = $1 limit 1", [
      certificateId,
    ]);
    if (
      state.rows[0]?.render_status === "ready" &&
      state.rows[0].status === "valid"
    ) {
      return true;
    }
    if (
      state.rows[0]?.render_status === "pending" &&
      state.rows[0].status === "valid"
    ) {
      throw new Error("certificate_render_in_progress");
    }
    return false;
  }

  try {
    const snapshot = parseCertificateRenderSnapshot(
      certificate.render_snapshot
    );
    const key = `certificates/${certificateId}/certificate.pdf`;
    const readStoredArtifact = async (): Promise<{
      pdf: Buffer;
      sha256: string;
    } | null> => {
      const response = await fetch(await createR2ObjectReadUrl({ key }));
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error("certificate_artifact_lookup_failed");
      }
      const pdf = Buffer.from(await response.arrayBuffer());
      return {
        pdf,
        sha256: createHash("sha256").update(pdf).digest("hex"),
      };
    };
    const storedArtifact = await readStoredArtifact();
    if (
      storedArtifact &&
      certificate.pdf_sha256 &&
      storedArtifact.sha256 !== certificate.pdf_sha256
    ) {
      throw new Error("certificate_artifact_hash_mismatch");
    }
    const artifact = storedArtifact
      ? storedArtifact
      : await (async () => {
          const [backgroundResponse, signatureResponse] = await Promise.all([
            fetch(
              await createR2ObjectReadUrl({
                key: snapshot.template.backgroundKey,
              })
            ),
            snapshot.template.signatureKey
              ? fetch(
                  await createR2ObjectReadUrl({
                    key: snapshot.template.signatureKey,
                  })
                )
              : Promise.resolve(null),
          ]);
          if (!backgroundResponse.ok) {
            throw new Error("certificate_background_unavailable");
          }
          if (snapshot.template.signatureKey && !signatureResponse?.ok) {
            throw new Error("certificate_signature_unavailable");
          }
          const rendered = await renderCertificatePdf({
            background: Buffer.from(await backgroundResponse.arrayBuffer()),
            publicBaseUrl: getServerEnv().CERTIFICATE_PUBLIC_BASE_URL,
            signature: signatureResponse?.ok
              ? Buffer.from(await signatureResponse.arrayBuffer())
              : null,
            snapshot,
          });
          const uploadResult = await uploadPrivateR2ObjectIfAbsent({
            body: rendered.pdf,
            contentType: "application/pdf",
            key,
            metadata: { sha256: rendered.sha256 },
          });
          if (uploadResult === "existing") {
            const winner = await readStoredArtifact();
            if (!winner) {
              throw new Error("certificate_artifact_missing_after_conflict");
            }
            return winner;
          }
          return rendered;
        })();

    const result = await pool.query(
      `update certificates
       set pdf_storage_key = $2,
           pdf_sha256 = $3,
           rendered_at = now(),
           render_status = 'ready',
           render_claim_token = null,
           render_claimed_at = null,
           updated_at = now()
       where id = $1
         and status = 'valid'
         and render_status = 'pending'
         and render_claim_token = $4`,
      [certificateId, key, artifact.sha256, claimToken]
    );
    if (result.rowCount === 1) {
      return true;
    }
    const state = await pool.query<{
      render_status: string;
      status: "revoked" | "valid";
    }>("select render_status, status from certificates where id = $1 limit 1", [
      certificateId,
    ]);
    if (
      state.rows[0]?.render_status === "ready" &&
      state.rows[0].status === "valid"
    ) {
      return true;
    }
    if (state.rows[0]?.status === "revoked") {
      await releaseClaim();
      return false;
    }
    throw new Error("certificate_render_claim_lost");
  } catch (error) {
    await releaseClaim();
    throw error;
  }
};

export const markCertificateRenderFailed = async (
  certificateId: string
): Promise<void> => {
  await getPool().query(
    `update certificates
     set render_status = 'failed',
         render_claim_token = null,
         render_claimed_at = null,
         updated_at = now()
     where id = $1
       and render_status = 'pending'
       and render_claim_token is null`,
    [certificateId]
  );
};
