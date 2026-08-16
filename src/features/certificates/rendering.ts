import { createHash } from "node:crypto";
import QRCode from "qrcode";
import sharp from "sharp";
import { formatDate } from "@/lib/formatters";
import { createCertificatePdfDocument } from "./pdf-document";
import type { CertificateRenderSnapshot } from "./render-snapshot";
import { getCertificateValidationPath } from "./rules";
import { CERTIFICATE_PAGE } from "./template-rules";

const pointsPerMillimeter = 72 / 25.4;
const CERTIFICATE_FIELD_OVERFLOW_TOLERANCE = 0.5;

const fieldValues = (
  snapshot: CertificateRenderSnapshot
): Record<string, string> => ({
  completedAt: formatDate(snapshot.completion.completedAt),
  courseTitle: snapshot.course.title,
  issuedAt: formatDate(snapshot.certificate.issuedAt),
  issuerCnpj: snapshot.issuer.cnpj,
  issuerName: snapshot.issuer.displayName,
  courseFreeStatement: snapshot.issuer.courseFreeStatement ?? "",
  signerName: snapshot.template.signerName ?? "",
  signerRole: snapshot.template.signerRole ?? "",
  studentName: snapshot.student.name,
  validationCode: snapshot.certificate.code,
  workloadHours: `${snapshot.course.workloadHours} horas`,
});

const getVerticalTextOffset = ({
  height,
  measuredHeight,
  verticalAlign,
}: {
  height: number;
  measuredHeight: number;
  verticalAlign: "top" | "middle" | "bottom" | undefined;
}): number => {
  if (verticalAlign === "top") {
    return 0;
  }
  if (verticalAlign === "bottom") {
    return Math.max(0, height - measuredHeight);
  }
  return Math.max(0, (height - measuredHeight) / 2);
};

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
  const document = createCertificatePdfDocument({
    info: {
      Author: snapshot.issuer.displayName,
      CreationDate: new Date(snapshot.certificate.issuedAt),
      Creator: "Hub",
      Keywords: `certificado,verificacao,${snapshot.certificate.code}`,
      ModDate: new Date(snapshot.certificate.issuedAt),
      Subject: `Certificado de conclusao: ${snapshot.course.title}`,
      Title: `Certificado ${snapshot.certificate.code}`,
    },
    layout: "landscape",
    margin: 0,
    size: "A4",
  });
  const chunks: Buffer[] = [];
  const pdfPromise = new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.once("end", () => resolve(Buffer.concat(chunks)));
    document.once("error", reject);
  });
  const values = fieldValues(snapshot);
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

    const value = values[field.field];
    if (value) {
      document.font(field.font ?? "Helvetica").fontSize(field.fontSize);
      const measuredHeight = document.heightOfString(value, {
        align: field.align,
        width,
      });
      if (measuredHeight > height + CERTIFICATE_FIELD_OVERFLOW_TOLERANCE) {
        throw new Error(`certificate_field_overflow:${field.field}`);
      }
      const verticalOffset = getVerticalTextOffset({
        height,
        measuredHeight,
        verticalAlign: field.verticalAlign,
      });
      document.fillColor(field.color).text(value, x, y + verticalOffset, {
        align: field.align,
        height,
        width,
      });
    }
  }

  document.end();
  const pdf = await pdfPromise;

  return {
    pdf,
    sha256: createHash("sha256").update(pdf).digest("hex"),
  };
};
