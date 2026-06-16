import { Download01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
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
import { formatDate } from "@/lib/formatters";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MyCertificatesPage(): Promise<React.JSX.Element> {
  const session = await requireSession();
  const certificates = await getCertificatesForUser(session.user.id);

  return (
    <div className="min-h-screen bg-background px-5 py-6 text-foreground sm:px-8 lg:px-10">
      <h1 className="font-bold text-3xl tracking-tight">Meus certificados</h1>
      <div className="mt-8 grid gap-4">
        {certificates.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Seus certificados aparecem aqui quando voce conclui 100% de um
                curso.
              </p>
            </CardContent>
          </Card>
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
                      className="gap-2"
                      href={route(`/certificados/${certificate.code}/pdf`)}
                    >
                      <HugeiconsIcon
                        icon={Download01Icon}
                        size={16}
                        strokeWidth={2}
                      />
                      Baixar PDF
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={route(`/certificados/${certificate.code}`)}>
                      Validar
                    </Link>
                  </Button>
                </CardAction>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
