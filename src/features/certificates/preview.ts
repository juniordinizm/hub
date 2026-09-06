import { createHash } from "node:crypto";
import QRCode from "qrcode";
import sharp from "sharp";
import { formatDate } from "@/lib/formatters";
import {
  CERTIFICATE_FONT_FAMILY,
  configureCertificateFontRuntime,
} from "./font-assets";
import type { CertificateRenderSnapshot } from "./render-snapshot";
import { getCertificateValidationPath } from "./rules";
import { CERTIFICATE_PAGE } from "./template-rules";

const PREVIEW_WIDTH = 1200;
const PREVIEW_HEIGHT = Math.round(
  PREVIEW_WIDTH * (CERTIFICATE_PAGE.height / CERTIFICATE_PAGE.width)
);
const POINTS_PER_MILLIMETER = 72 / 25.4;
const PDF_PAGE_WIDTH_POINTS = CERTIFICATE_PAGE.width * POINTS_PER_MILLIMETER;
const PREVIEW_SCALE = PREVIEW_WIDTH / PDF_PAGE_WIDTH_POINTS;
const WHITESPACE_PATTERN = /\s+/;

const escapeXml = (value: string): string =>
  value.replace(
    /[<>&'"]/g,
    (character) =>
      ({
        '"': "&quot;",
        "&": "&amp;",
        "'": "&apos;",
        "<": "&lt;",
        ">": "&gt;",
      })[character] ?? character
  );

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

const wrapText = (value: string, maxCharacters: number): string[] => {
  const words = value.trim().split(WHITESPACE_PATTERN).filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && candidate.length > maxCharacters) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
};

const getTextAnchor = (align: "center" | "left" | "right"): string => {
  if (align === "center") {
    return "middle";
  }
  if (align === "right") {
    return "end";
  }
  return "start";
};

const createTextSvg = ({
  field,
  height,
  index,
  value,
  width,
  x,
  y,
}: {
  field: CertificateRenderSnapshot["template"]["fields"][number];
  height: number;
  index: number;
  value: string;
  width: number;
  x: number;
  y: number;
}): string => {
  const fontSize = field.fontSize * PREVIEW_SCALE;
  const lineHeight = fontSize * 1.15;
  const maxCharacters = Math.max(1, Math.floor(width / (fontSize * 0.56)));
  const lines = wrapText(value, maxCharacters);
  const contentHeight = lines.length * lineHeight;
  let verticalOffset = Math.max(0, (height - contentHeight) / 2);
  if (field.verticalAlign === "top") {
    verticalOffset = 0;
  } else if (field.verticalAlign === "bottom") {
    verticalOffset = Math.max(0, height - contentHeight);
  }
  const baseline = y + verticalOffset + fontSize;
  const anchor = getTextAnchor(field.align);
  let textX = x + width / 2;
  if (field.align === "left") {
    textX = x;
  } else if (field.align === "right") {
    textX = x + width;
  }
  const clipId = `certificate-preview-field-${index}`;
  const text = lines
    .map(
      (line, lineIndex) =>
        `<text x="${textX}" y="${baseline + lineIndex * lineHeight}" text-anchor="${anchor}">${escapeXml(line)}</text>`
    )
    .join("");

  return `<clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${width}" height="${height}" /></clipPath><g clip-path="url(#${clipId})" fill="${escapeXml(field.color)}" font-family="${CERTIFICATE_FONT_FAMILY}" font-size="${fontSize}" font-weight="${field.font === "Helvetica-Bold" ? 700 : 400}">${text}</g>`;
};

export const createCertificatePreviewSvg = ({
  qrDataUrl,
  signatureDataUrl,
  snapshot,
}: {
  qrDataUrl: string;
  signatureDataUrl: string | null;
  snapshot: CertificateRenderSnapshot;
}): string => {
  const values = fieldValues(snapshot);
  const elements: string[] = [];

  snapshot.template.fields.forEach((field, index) => {
    if (!field.visible) {
      return;
    }
    const x = (field.x / 100) * PREVIEW_WIDTH;
    const y = (field.y / 100) * PREVIEW_HEIGHT;
    const width = (field.width / 100) * PREVIEW_WIDTH;
    const height = (field.height / 100) * PREVIEW_HEIGHT;

    if (field.field === "qrCode") {
      elements.push(
        `<image x="${x}" y="${y}" width="${width}" height="${height}" href="${qrDataUrl}" preserveAspectRatio="none" />`
      );
      return;
    }
    if (field.field === "signatureImage") {
      if (signatureDataUrl) {
        elements.push(
          `<image x="${x}" y="${y}" width="${width}" height="${height}" href="${signatureDataUrl}" preserveAspectRatio="xMidYMid meet" />`
        );
      }
      return;
    }

    const value = values[field.field];
    if (value) {
      elements.push(
        createTextSvg({ field, height, index, value, width, x, y })
      );
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PREVIEW_WIDTH}" height="${PREVIEW_HEIGHT}" viewBox="0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}">${elements.join("")}</svg>`;
};

export const renderCertificatePreview = async ({
  background,
  publicBaseUrl,
  signature,
  snapshot,
}: {
  background: Buffer;
  publicBaseUrl: string;
  signature: Buffer | null;
  snapshot: CertificateRenderSnapshot;
}): Promise<{ png: Buffer; sha256: string }> => {
  configureCertificateFontRuntime();

  const validationUrl = new URL(
    getCertificateValidationPath(snapshot.certificate.code),
    publicBaseUrl
  ).toString();
  const qrDataUrl = await QRCode.toDataURL(validationUrl, { margin: 1 });
  const backgroundPng = await sharp(background)
    .resize({ height: PREVIEW_HEIGHT, width: PREVIEW_WIDTH, fit: "fill" })
    .png()
    .toBuffer();
  const signatureDataUrl = signature
    ? `data:image/png;base64,${(await sharp(signature).png().toBuffer()).toString("base64")}`
    : null;
  const svg = createCertificatePreviewSvg({
    qrDataUrl,
    signatureDataUrl,
    snapshot,
  });
  const png = await sharp(backgroundPng)
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toBuffer();

  return {
    png,
    sha256: createHash("sha256").update(png).digest("hex"),
  };
};

export const CERTIFICATE_PREVIEW_DIMENSIONS = {
  height: PREVIEW_HEIGHT,
  width: PREVIEW_WIDTH,
} as const;
