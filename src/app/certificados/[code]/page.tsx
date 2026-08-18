import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { consumePublicCertificateLookup } from "@/features/certificates/public-rate-limit";
import { certificateReasonLabel } from "@/features/certificates/reasons";
import { getCertificateByCode } from "@/features/certificates/server";
import { formatDate } from "@/lib/formatters";
import { CertificatePublicActions } from "./certificate-public-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

const getCertificateStatusLabel = (certificate: {
  renderStatus: "failed" | "pending" | "ready";
  status: "revoked" | "valid";
}): string => {
  if (certificate.status === "revoked") {
    return "Certificado revogado";
  }
  if (certificate.renderStatus === "pending") {
    return "Certificado em preparação";
  }
  if (certificate.renderStatus === "failed") {
    return "Certificado indisponível";
  }
  return "Certificado válido";
};

const CertificateStateMessage = ({
  certificate,
}: {
  certificate: {
    renderStatus: "failed" | "pending" | "ready";
    status: "revoked" | "valid";
  };
}): React.JSX.Element | null => {
  if (certificate.status === "revoked") {
    return (
      <p className="mt-4 text-destructive">
        Este certificado não é válido. O PDF não está disponível para download.
      </p>
    );
  }
  if (certificate.renderStatus === "pending") {
    return (
      <p className="mt-4 text-muted-foreground">
        Este certificado está sendo preparado. O PDF ficará disponível quando a
        emissão terminar.
      </p>
    );
  }
  if (certificate.renderStatus === "failed") {
    return (
      <p className="mt-4 text-destructive">
        O PDF não pôde ser preparado. Entre em contato com o Suporte para
        revisar este certificado.
      </p>
    );
  }
  return null;
};

export default async function CertificateValidationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<React.JSX.Element> {
  const { code } = await params;
  const limit = await consumePublicCertificateLookup(await headers());

  if (limit === "limited") {
    notFound();
  }
  const certificate = await getCertificateByCode(code);

  if (!certificate) {
    notFound();
  }

  const pdfHref = `/certificados/${encodeURIComponent(certificate.code)}/pdf`;
  const isReady =
    certificate.status === "valid" && certificate.renderStatus === "ready";

  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <Badge className="w-fit" variant="outline">
            {getCertificateStatusLabel(certificate)}
          </Badge>
          <h1 className="font-heading font-medium text-3xl">
            {certificate.courseTitle}
          </h1>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Compare estes dados com o documento apresentado antes de confiar
            nesta credencial.
          </p>
          <CertificateStateMessage certificate={certificate} />
          <dl className="mt-4 grid gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Emissor</dt>
              <dd className="font-semibold">
                {certificate.issuerName ?? "Não registrado"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">CNPJ do emissor</dt>
              <dd className="font-semibold">
                {certificate.issuerCnpj ?? "Não registrado"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Conclusão</dt>
              <dd className="font-semibold">
                {certificate.completionAt
                  ? formatDate(certificate.completionAt)
                  : "Não registrada"}
              </dd>
            </div>
          </dl>
          <dl className="grid gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Aluno</dt>
              <dd className="font-semibold">{certificate.studentName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Carga horaria</dt>
              <dd className="font-semibold">
                {certificate.workloadHours} horas
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Emissao</dt>
              <dd className="font-semibold">
                {formatDate(certificate.issuedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Codigo</dt>
              <dd className="font-mono font-semibold">{certificate.code}</dd>
            </div>
            {certificate.status === "revoked" ? (
              <>
                <div>
                  <dt className="text-muted-foreground">Revogado em</dt>
                  <dd className="font-semibold">
                    {certificate.revokedAt
                      ? formatDate(certificate.revokedAt)
                      : "Data não registrada"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Motivo</dt>
                  <dd className="font-semibold">
                    {certificate.revokedReasonCategory
                      ? certificateReasonLabel(
                          certificate.revokedReasonCategory
                        )
                      : "Motivo administrativo"}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
          {isReady ? (
            <section aria-labelledby="certificate-pdf-heading" className="mt-8">
              <h2
                className="font-heading font-semibold text-lg"
                id="certificate-pdf-heading"
              >
                Documento PDF
              </h2>
              <div className="mt-3 overflow-hidden rounded-lg border bg-muted">
                <iframe
                  className="h-[min(70vh,42rem)] w-full"
                  src={pdfHref}
                  title="Prévia do certificado"
                >
                  <p className="p-4 text-sm">
                    A prévia não está disponível neste navegador. Use o link
                    para baixar o PDF.
                  </p>
                </iframe>
              </div>
              <CertificatePublicActions
                code={certificate.code}
                pdfHref={pdfHref}
              />
            </section>
          ) : null}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
