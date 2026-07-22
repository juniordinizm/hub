import { createHash } from "node:crypto";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import sharp from "sharp";
import type { CertificateRenderSnapshot } from "./render-snapshot";
import { getCertificateValidationPath } from "./rules";
import { CERTIFICATE_PAGE } from "./template-rules";

const pointsPerMillimeter = 72 / 25.4;

const formatCertificateDate = (value: string): string =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));

const fieldValues = (
  snapshot: CertificateRenderSnapshot
): Record<string, string> => ({
  completedAt: formatCertificateDate(snapshot.completion.completedAt),
  courseFreeStatement: snapshot.issuer.courseFreeStatement,
  courseTitle: snapshot.course.title,
  issuedAt: formatCertificateDate(snapshot.certificate.issuedAt),
  issuerCnpj: snapshot.issuer.cnpj,
  issuerName: snapshot.issuer.displayName,
  signerName: snapshot.template.signerName ?? "",
  studentName: snapshot.student.name,
  validationCode: snapshot.certificate.code,
  workloadHours: `${snapshot.course.workloadHours} horas`,
});

export const renderCertificatePdf = async ({
  background,
  publicBaseUrl,
  signature,
  snapshot,
}: {
  background: Buffer;
  publicBaseUrl: string;
  signature: Buffer | null;
  snapshot: CertificateRenderSnapshot;
}): Promise<{ pdf: Buffer; sha256: string }> => {
  const validationUrl = new URL(
    getCertificateValidationPath(snapshot.certificate.code),
    publicBaseUrl
  ).toString();
  const qrDataUrl = await QRCode.toDataURL(validationUrl, { margin: 1 });
  const backgroundForPdf = await sharp(background).png().toBuffer();
  const signatureForPdf = signature
    ? await sharp(signature).png().toBuffer()
    : null;
  const pageWidth = CERTIFICATE_PAGE.width * pointsPerMillimeter;
  const pageHeight = CERTIFICATE_PAGE.height * pointsPerMillimeter;
  const document = new PDFDocument({
    info: {
      CreationDate: new Date(snapshot.certificate.issuedAt),
      ModDate: new Date(snapshot.certificate.issuedAt),
      Title: `Certificado ${snapshot.certificate.code}`,
    },
    layout: "landscape",
    margin: 0,
    size: "A4",
  });
  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  document.image(backgroundForPdf, 0, 0, {
    height: pageHeight,
    width: pageWidth,
  });

  for (const field of snapshot.template.fields) {
    if (!field.visible) {
      continue;
    }

    const x = (field.x / 100) * pageWidth;
    const y = (field.y / 100) * pageHeight;
    const width = (field.width / 100) * pageWidth;
    const height = (field.height / 100) * pageHeight;

    if (field.field === "qrCode") {
      document.image(
        Buffer.from(qrDataUrl.split(",")[1] ?? "", "base64"),
        x,
        y,
        {
          height,
          width,
        }
      );
      continue;
    }

    if (field.field === "signatureImage") {
      if (signatureForPdf) {
        document.image(signatureForPdf, x, y, { fit: [width, height] });
      }
      continue;
    }

    const value = fieldValues(snapshot)[field.field];
    if (value) {
      document
        .font(field.font ?? "Helvetica")
        .fillColor(field.color)
        .fontSize(field.fontSize)
        .text(value, x, y, { align: field.align, height, width });
    }
  }

  document.end();
  const pdf = await new Promise<Buffer>((resolve) =>
    document.on("end", () => resolve(Buffer.concat(chunks)))
  );

  return {
    pdf,
    sha256: createHash("sha256").update(pdf).digest("hex"),
  };
};
