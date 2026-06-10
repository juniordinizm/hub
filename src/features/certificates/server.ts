import "server-only";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { getPool } from "@/db";
import { getCertificateValidationPath } from "@/features/certificates/rules";
import { getServerEnv } from "@/lib/env";

export interface CertificateRecord {
  code: string;
  courseTitle: string;
  issuedAt: Date;
  studentName: string;
  workloadHours: number;
}

export const getCertificateByCode = async (
  code: string
): Promise<CertificateRecord | null> => {
  const { rows } = await getPool().query<{
    code: string;
    student_name_snapshot: string;
    course_title_snapshot: string;
    workload_hours_snapshot: number;
    issued_at: Date;
  }>(
    `
      select
        code,
        student_name_snapshot,
        course_title_snapshot,
        workload_hours_snapshot,
        issued_at
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
  }>(
    `
      select
        code,
        student_name_snapshot,
        course_title_snapshot,
        workload_hours_snapshot,
        issued_at
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
  doc.image(qrBuffer, 660, 365, { height: 110, width: 110 });
  doc.end();

  return await new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
};
