import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/page-container";
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
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";
import { CertificateCard } from "./certificate-card";
import { PendingCertificateRefresh } from "./pending-certificate-refresh";

export const dynamic = "force-dynamic";

export default async function MyCertificatesPage(): Promise<React.JSX.Element> {
  const session = await requireSession();

  if (!canMutateStudentExperience(session.role)) {
    redirect(route("/admin"));
  }

  const certificates = await getCertificatesForUser(session.user.id);
  const hasPendingCertificate = certificates.some(
    (certificate) =>
      certificate.status === "valid" && certificate.renderStatus === "pending"
  );

  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      {hasPendingCertificate ? <PendingCertificateRefresh enabled /> : null}
      <div className="flex flex-col gap-8">
        <header className="border-b pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 space-y-1">
              <h1 className="font-bold text-3xl tracking-tight">
                Seus certificados
              </h1>
              <p className="text-muted-foreground text-sm">
                Acompanhe o preparo, baixe documentos disponíveis e valide cada
                conclusão pelo código público.
              </p>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 rounded-lg border bg-card p-4 md:max-w-xs">
          <Metric label="Emitidos" value={certificates.length.toString()} />
          <Metric label="Validação" value="QR" />
        </section>

        <section className="grid gap-4">
          {certificates.length === 0 ? (
            <EmptyCertificatesState />
          ) : (
            certificates.map((certificate) => (
              <CertificateCard
                certificate={certificate}
                key={certificate.code}
              />
            ))
          )}
        </section>
      </div>
    </PageContainer>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="rounded-md bg-background/45 px-3 py-3">
      <p className="font-bold text-2xl tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}

function EmptyCertificatesState(): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Em andamento</CardDescription>
        <CardTitle>Nenhum certificado emitido ainda</CardTitle>
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
