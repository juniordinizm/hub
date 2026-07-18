import {
  Award01Icon,
  Certificate01Icon,
  Download01Icon,
  FileValidationIcon,
  Shield01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCertificatesForUser } from "@/features/certificates/server";
import { canMutateStudentExperience } from "@/features/courses/preview";
import { formatDate } from "@/lib/formatters";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MyCertificatesPage(): Promise<React.JSX.Element> {
  const session = await requireSession();

  if (!canMutateStudentExperience(session.role)) {
    redirect(route("/admin"));
  }

  const certificates = await getCertificatesForUser(session.user.id);

  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <div className="flex flex-col gap-8">
        <header className="border-b pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 space-y-1">
              <h1 className="font-bold text-3xl tracking-tight">
                Suas conclusões validadas
              </h1>
              <p className="text-muted-foreground text-sm">
                Cada certificado emitido fica disponível para download e
                validação pública por código.
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
              <Card key={certificate.code}>
                <CardHeader>
                  <CardDescription>
                    Emitido em {formatDate(certificate.issuedAt)}
                  </CardDescription>
                  <CardTitle>{certificate.courseTitle}</CardTitle>
                  <CardDescription className="font-mono">
                    {certificate.code}
                  </CardDescription>
                  <CardAction className="flex gap-2">
                    <Button asChild>
                      <Link
                        href={route(`/certificados/${certificate.code}/pdf`)}
                      >
                        <HugeiconsIcon icon={Download01Icon} />
                        Baixar PDF
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={route(`/certificados/${certificate.code}`)}>
                        <HugeiconsIcon icon={FileValidationIcon} />
                        Validar
                      </Link>
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 text-sm sm:grid-cols-3">
                    <InfoPill
                      icon={Certificate01Icon}
                      label="Certificado digital"
                    />
                    <InfoPill icon={Shield01Icon} label="Código verificável" />
                    <InfoPill icon={Award01Icon} label="Conclusão do curso" />
                  </div>
                </CardContent>
              </Card>
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

function InfoPill({
  icon,
  label,
}: {
  icon: typeof Certificate01Icon;
  label: string;
}): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border bg-background/45 px-3 py-2 text-muted-foreground">
      <HugeiconsIcon icon={icon} />
      {label}
    </span>
  );
}
