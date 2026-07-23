"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import type { CertificateTemplateField } from "@/features/certificates/template-rules";

const samples = {
  long: {
    completedAt: "22 de julho de 2026",
    courseFreeStatement: "Certificado de conclusão de curso livre.",
    courseTitle: "Especialização em Técnicas Avançadas de Harmonização Facial",
    issuedAt: "22 de julho de 2026",
    issuerCnpj: "12.345.678/0001-90",
    issuerName: "Instituto Protea Educação Profissional",
    signerName: "Dra. Maria Fernanda de Albuquerque",
    studentName: "Ana Carolina de Souza e Silva",
    validationCode: "PRT-12345678",
    workloadHours: "120 horas",
  },
  short: {
    completedAt: "22/07/2026",
    courseFreeStatement: "Curso livre.",
    courseTitle: "Botox",
    issuedAt: "22/07/2026",
    issuerCnpj: "12.345.678/0001-90",
    issuerName: "Protea",
    signerName: "Dra. Ana",
    studentName: "Ana",
    validationCode: "PRT-123",
    workloadHours: "8 horas",
  },
} as const;

export function CertificateTemplatePreview({
  backgroundUrl,
  fields,
  signatureUrl,
  variant,
}: {
  backgroundUrl: string | null;
  fields: CertificateTemplateField[];
  signatureUrl: string | null;
  variant: "long" | "short";
}): React.JSX.Element {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const values = samples[variant];

  useEffect(() => {
    QRCode.toDataURL("https://hub.example.test/certificados/PRT-12345678", {
      margin: 1,
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, []);

  const visibleFields = useMemo(
    () => fields.filter((field) => field.visible),
    [fields]
  );

  return (
    <div className="aspect-[1.414/1] overflow-hidden rounded-lg border bg-muted p-2 shadow-inner">
      <div className="relative size-full overflow-hidden rounded-md bg-background">
        {backgroundUrl ? (
          <Image
            alt="Arte do certificado"
            className="object-cover"
            fill
            sizes="(min-width: 1024px) 60vw, 100vw"
            src={backgroundUrl}
            unoptimized
          />
        ) : null}
        {visibleFields.map((field) => {
          const frame = {
            height: `${field.height}%`,
            left: `${field.x}%`,
            top: `${field.y}%`,
            width: `${field.width}%`,
          };
          if (field.field === "qrCode") {
            return qrDataUrl ? (
              <Image
                alt="Código QR de validação"
                className="absolute object-contain"
                height={128}
                key={field.field}
                src={qrDataUrl}
                style={frame}
                unoptimized
                width={128}
              />
            ) : null;
          }
          if (field.field === "signatureImage") {
            return signatureUrl ? (
              <Image
                alt="Assinatura visual"
                className="absolute object-contain"
                height={128}
                key={field.field}
                src={signatureUrl}
                style={frame}
                unoptimized
                width={128}
              />
            ) : null;
          }
          const value = values[field.field];
          return (
            <p
              className="absolute overflow-hidden text-center leading-tight"
              key={field.field}
              style={{
                ...frame,
                color: field.color,
                fontFamily: field.font ?? "Helvetica",
                fontSize: `${field.fontSize * 0.32}px`,
                textAlign: field.align,
              }}
            >
              {value}
            </p>
          );
        })}
      </div>
    </div>
  );
}
