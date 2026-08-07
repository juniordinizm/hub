"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CertificateTemplateField } from "@/features/certificates/template-rules";
import { cn } from "@/lib/utils";
import {
  getCertificatePreviewFrame,
  getCertificatePreviewTextStyle,
} from "./certificate-template-preview-layout";

const samples = {
  long: {
    completedAt: "22 de julho de 2026",
    courseFreeStatement: "Certificado de conclusão de curso livre.",
    courseTitle: "Especialização em Técnicas Avançadas de Harmonização Facial",
    issuedAt: "22 de julho de 2026",
    issuerCnpj: "12.345.678/0001-90",
    issuerName: "Instituto Protea Educação Profissional",
    signerName: "Dra. Maria Fernanda de Albuquerque",
    signerRole: "Responsável técnica",
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
    signerRole: "Especialista",
    studentName: "Ana",
    validationCode: "PRT-123",
    workloadHours: "8 horas",
  },
} as const;

export function CertificateTemplatePreview({
  backgroundUrl,
  fields,
  overlapFields,
  signatureUrl,
  signerName,
  signerRole,
  variant,
}: {
  backgroundUrl: string | null;
  fields: CertificateTemplateField[];
  overlapFields: ReadonlySet<CertificateTemplateField["field"]>;
  signatureUrl: string | null;
  signerName: string;
  signerRole: string;
  variant: "long" | "short";
}): React.JSX.Element {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [renderedWidth, setRenderedWidth] = useState(0);
  const pageRef = useRef<HTMLDivElement>(null);
  const values = {
    ...samples[variant],
    signerName: signerName.trim() || samples[variant].signerName,
    signerRole: signerRole.trim() || samples[variant].signerRole,
  };

  useEffect(() => {
    QRCode.toDataURL("https://hub.example.test/certificados/PRT-12345678", {
      margin: 1,
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, []);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) {
      return;
    }
    const updateWidth = (): void => setRenderedWidth(page.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(page);
    return () => observer.disconnect();
  }, []);

  const visibleFields = useMemo(
    () => fields.filter((field) => field.visible),
    [fields]
  );

  return (
    <div className="aspect-[1.414/1] overflow-hidden rounded-xl bg-muted p-2 shadow-inner ring-1 ring-black/10 dark:ring-white/10">
      <div
        className="relative size-full overflow-hidden rounded-lg bg-background"
        ref={pageRef}
      >
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
          const frame = getCertificatePreviewFrame(field);
          const hasOverlap = overlapFields.has(field.field);
          const overlapClassName = hasOverlap
            ? "bg-amber-400/10 ring-2 ring-amber-500 ring-offset-1 ring-offset-background"
            : "";
          const overlapMarker = hasOverlap ? "true" : undefined;
          if (field.field === "qrCode") {
            return qrDataUrl ? (
              <Image
                alt="Código QR de validação"
                className={cn("absolute", overlapClassName)}
                data-overlap={overlapMarker}
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
                className={cn("absolute object-contain", overlapClassName)}
                data-overlap={overlapMarker}
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
              className={cn("absolute overflow-hidden", overlapClassName)}
              data-overlap={overlapMarker}
              key={field.field}
              style={getCertificatePreviewTextStyle(field, renderedWidth)}
            >
              {value}
            </p>
          );
        })}
      </div>
    </div>
  );
}
