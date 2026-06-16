import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCertificateByCode } from "@/features/certificates/server";
import { formatDate } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function CertificateValidationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<React.JSX.Element> {
  const { code } = await params;
  const certificate = await getCertificateByCode(code);

  if (!certificate) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background px-5 py-12 text-foreground">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <Badge className="w-fit" variant="outline">
            Certificado valido
          </Badge>
          <CardTitle className="text-3xl">{certificate.courseTitle}</CardTitle>
        </CardHeader>
        <CardContent>
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
          </dl>
        </CardContent>
      </Card>
    </main>
  );
}
