import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { consumePublicCertificateLookup } from "@/features/certificates/public-rate-limit";
import { certificateReasonLabel } from "@/features/certificates/reasons";
import { getCertificateByCode } from "@/features/certificates/server";
import { formatDate } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
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

  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <Badge className="w-fit" variant="outline">
            {certificate.status === "valid"
              ? "Certificado valido"
              : "Certificado revogado"}
          </Badge>
          <CardTitle className="text-3xl">{certificate.courseTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Compare estes dados com o documento apresentado antes de confiar
            nesta credencial.
          </p>
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
        </CardContent>
      </Card>
    </PageContainer>
  );
}
