import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCertificatesForUser } from "@/features/certificates/server";
import { canMutateStudentExperience } from "@/features/courses/preview";
import { getServerEnv } from "@/lib/env";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";
import { CertificateCard } from "./certificate-card";
import { getCertificateLinks } from "./certificate-links";
import { PendingCertificateRefresh } from "./pending-certificate-refresh";

export const dynamic = "force-dynamic";

export default async function MyCertificatesPage(): Promise<React.JSX.Element> {
  const session = await requireSession();

  if (!canMutateStudentExperience(session.role)) {
    redirect(route("/admin"));
  }

  const certificates = await getCertificatesForUser(session.user.id);
  const publicBaseUrl = getServerEnv().CERTIFICATE_PUBLIC_BASE_URL;
  const hasPendingCertificate = certificates.some(
    (certificate) =>
      certificate.status === "valid" && certificate.renderStatus === "pending"
  );

  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      {hasPendingCertificate ? <PendingCertificateRefresh enabled /> : null}
      <div className="flex flex-col gap-8">
        <PageHeader
          description="Acompanhe o preparo, baixe documentos disponíveis e valide cada conclusão pelo código público."
          title="Seus certificados"
        />

        <section className="grid gap-4">
          {certificates.length === 0 ? (
            <EmptyCertificatesState />
          ) : (
            certificates.map((certificate) => (
              <CertificateCard
                certificate={certificate}
                key={certificate.code}
                publicUrl={
                  getCertificateLinks({
                    code: certificate.code,
                    publicUrl: publicBaseUrl,
                  }).publicUrl
                }
              />
            ))
          )}
        </section>
      </div>
    </PageContainer>
  );
}

function EmptyCertificatesState(): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Em andamento</CardDescription>
        <CardTitle as="h2">Nenhum certificado emitido ainda</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="max-w-2xl text-muted-foreground text-sm leading-6">
          Conclua 100% das aulas de um curso ativo para liberar o certificado e
          o link público de validação.
        </p>
        <Button asChild className="mt-5" variant="outline">
          <Link href={route("/app")}>Voltar para meus cursos</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
