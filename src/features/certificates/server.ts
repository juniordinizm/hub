import "server-only";
import { randomUUID } from "node:crypto";
import PDFDocument from "pdfkit";
import type { PoolClient } from "pg";
import QRCode from "qrcode";
import { getPool } from "@/db";
import {
  createCertificateCode,
  getCertificateValidationPath,
} from "@/features/certificates/rules";
import { getServerEnv } from "@/lib/env";

export interface CertificateRecord {
  code: string;
  courseTitle: string;
  issuedAt: Date;
  status: "revoked" | "valid";
  studentName: string;
  workloadHours: number;
}

export const tryIssueAutomaticCompletionCertificate = async ({
  client,
  courseId,
  courseTitle,
  studentName,
  userId,
  workloadHours,
}: {
  client: PoolClient;
  courseId: string;
  courseTitle: string;
  studentName: string;
  userId: string;
  workloadHours: number;
}): Promise<string | null> => {
  const candidateCode = createCertificateCode(randomUUID());
  const certificate = await client.query<{ code: string }>(
    `
      insert into certificates (
        user_id,
        course_id,
        code,
        student_name_snapshot,
        course_title_snapshot,
        workload_hours_snapshot
      )
      values ($1, $2, $3, $4, $5, $6)
      on conflict do nothing
      returning code
    `,
    [userId, courseId, candidateCode, studentName, courseTitle, workloadHours]
  );

  return certificate.rows[0]?.code ?? null;
};

const auditCertificate = async ({
  action,
  actorUserId,
  certificateId,
  client,
}: {
  action: string;
  actorUserId: string;
  certificateId: string;
  client: PoolClient;
}): Promise<void> => {
  await client.query(
    `
      insert into audit_logs (actor_user_id, action, target_type, target_id)
      values ($1, $2, 'certificate', $3)
    `,
    [actorUserId, action, certificateId]
  );
};

const issueCertificate = async ({
  actorUserId,
  client,
  courseId,
  replacesCertificateId,
  userId,
}: {
  actorUserId: string;
  client: PoolClient;
  courseId: string;
  replacesCertificateId?: string;
  userId: string;
}): Promise<{ id: string }> => {
  const snapshot = await client.query<{
    course_title: string;
    student_name: string;
    workload_hours: number;
  }>(
    `
      select u.name as student_name, c.title as course_title, c.workload_hours
      from users u
      cross join courses c
      where u.id = $1 and c.id = $2
      limit 1
    `,
    [userId, courseId]
  );
  const source = snapshot.rows[0];

  if (!source) {
    throw new Error("Aluna ou curso nao localizado.");
  }

  const certificate = await client.query<{ id: string }>(
    `
      insert into certificates (
        user_id,
        course_id,
        code,
        student_name_snapshot,
        course_title_snapshot,
        workload_hours_snapshot,
        replaces_certificate_id
      )
      values ($1, $2, $3, $4, $5, $6, $7)
      returning id
    `,
    [
      userId,
      courseId,
      randomUUID(),
      source.student_name,
      source.course_title,
      source.workload_hours,
      replacesCertificateId ?? null,
    ]
  );
  const certificateId = certificate.rows[0]?.id;

  if (!certificateId) {
    throw new Error("Nao foi possivel emitir o certificado.");
  }

  await auditCertificate({
    action: replacesCertificateId
      ? "certificate.reissued"
      : "certificate.issued",
    actorUserId,
    certificateId,
    client,
  });
  return { id: certificateId };
};

export const issueManualCertificate = async ({
  actorUserId,
  courseId,
  reason,
  userId,
}: {
  actorUserId: string;
  courseId: string;
  reason: string;
  userId: string;
}): Promise<{ id: string }> => {
  if (!reason.trim()) {
    throw new Error("Informe o motivo da emissao manual.");
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const certificate = await issueCertificate({
      actorUserId,
      client,
      courseId,
      userId,
    });
    await client.query(
      `
        update audit_logs
        set metadata = jsonb_build_object('reason', $2::text)
        where target_type = 'certificate'
          and target_id = $1
          and action = 'certificate.issued'
      `,
      [certificate.id, reason.trim()]
    );
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
  reason,
}: {
  actorUserId: string;
  certificateId: string;
  reason: string;
}): Promise<void> => {
  if (!reason.trim()) {
    throw new Error("Informe o motivo da revogacao.");
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{ id: string }>(
      `
        update certificates
        set status = 'revoked',
            revoked_at = now(),
            revoked_reason = $2,
            revoked_by_user_id = $3,
            updated_at = now()
        where id = $1
          and status = 'valid'
        returning id
      `,
      [certificateId, reason.trim(), actorUserId]
    );

    if (!result.rows[0]) {
      throw new Error("Certificado invalido ou ja revogado.");
    }

    await auditCertificate({
      action: "certificate.revoked",
      actorUserId,
      certificateId,
      client,
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
  reason,
}: {
  actorUserId: string;
  certificateId: string;
  reason: string;
}): Promise<{ id: string }> => {
  if (!reason.trim()) {
    throw new Error("Informe o motivo da reemissao.");
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const previous = await client.query<{ course_id: string; user_id: string }>(
      `
        update certificates
        set status = 'revoked',
            revoked_at = now(),
            revoked_reason = $2,
            revoked_by_user_id = $3,
            updated_at = now()
        where id = $1
          and status = 'valid'
        returning user_id, course_id
      `,
      [certificateId, reason.trim(), actorUserId]
    );
    const previousCertificate = previous.rows[0];

    if (!previousCertificate) {
      throw new Error("Certificado invalido ou ja revogado.");
    }

    await auditCertificate({
      action: "certificate.revoked_for_reissue",
      actorUserId,
      certificateId,
      client,
    });
    const replacement = await issueCertificate({
      actorUserId,
      client,
      courseId: previousCertificate.course_id,
      replacesCertificateId: certificateId,
      userId: previousCertificate.user_id,
    });
    await client.query(
      `
        update audit_logs
        set metadata = jsonb_build_object('reason', $2::text)
        where target_type = 'certificate'
          and target_id in ($1, $3)
      `,
      [certificateId, reason.trim(), replacement.id]
    );
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
    student_name_snapshot: string;
    course_title_snapshot: string;
    workload_hours_snapshot: number;
    issued_at: Date;
    status: "revoked" | "valid";
  }>(
    `
      select
        code,
        student_name_snapshot,
        course_title_snapshot,
        workload_hours_snapshot,
        issued_at,
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
    studentName: row.student_name_snapshot,
    courseTitle: row.course_title_snapshot,
    workloadHours: row.workload_hours_snapshot,
    issuedAt: row.issued_at,
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
    status: "revoked" | "valid";
  }>(
    `
      select
        code,
        student_name_snapshot,
        course_title_snapshot,
        workload_hours_snapshot,
        issued_at,
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
    status: row.status,
  }));
};

export const renderCertificatePdf = async (
  certificate: CertificateRecord
): Promise<Buffer> => {
  const env = getServerEnv();
  const validationUrl = new URL(
    getCertificateValidationPath(certificate.code),
    env.CERTIFICATE_PUBLIC_BASE_URL
  ).toString();
  const qrDataUrl = await QRCode.toDataURL(validationUrl, { margin: 1 });
  const qrBuffer = Buffer.from(qrDataUrl.split(",")[1] ?? "", "base64");
  const doc = new PDFDocument({
    layout: "landscape",
    margin: 48,
    size: "A4",
  });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  doc.rect(24, 24, 794, 547).lineWidth(2).stroke("#326c71");
  doc.rect(34, 34, 774, 527).lineWidth(1).stroke("#d97b34");
  doc.fillColor("#326c71").fontSize(18).text("PROTEA-R Hub", 60, 72);
  doc.fillColor("#17292b").fontSize(42).text("Certificado", 60, 135);
  doc.fontSize(15).fillColor("#4a5f61").text("Certificamos que", 60, 205);
  doc
    .fontSize(30)
    .fillColor("#17292b")
    .text(certificate.studentName, 60, 235, { width: 560 });
  doc.fontSize(15).fillColor("#4a5f61").text("concluiu o curso", 60, 290);
  doc
    .fontSize(24)
    .fillColor("#326c71")
    .text(certificate.courseTitle, 60, 318, { width: 560 });
  doc
    .fontSize(13)
    .fillColor("#4a5f61")
    .text(`Carga horaria: ${certificate.workloadHours} horas`, 60, 375)
    .text(`Codigo: ${certificate.code}`, 60, 398)
    .text(`Validacao: ${validationUrl}`, 60, 421, { width: 560 });
  if (certificate.status === "revoked") {
    doc
      .fillColor("#b42318")
      .fontSize(18)
      .text("CERTIFICADO REVOGADO", 60, 456, { width: 560 });
  }
  doc.image(qrBuffer, 660, 365, { height: 110, width: 110 });
  doc.end();

  return await new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
};
