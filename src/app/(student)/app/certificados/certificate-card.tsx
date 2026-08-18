import { Download01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { SupportRequestDialog } from "@/components/support-request-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CertificateRecord } from "@/features/certificates/server";
import { formatDate } from "@/lib/formatters";
import { CertificateCopyLinkButton } from "./certificate-copy-link-button";
import { getCertificateLinks } from "./certificate-links";
import { getCertificateListViewModel } from "./certificate-list-view-model";
import { PendingCertificateRefresh } from "./pending-certificate-refresh";

export function CertificateCard({
  certificate,
  publicUrl,
}: {
  certificate: CertificateRecord;
  publicUrl: string;
}): React.JSX.Element {
  const viewModel = getCertificateListViewModel(certificate);
  const titleId = `certificate-${certificate.code}-title`;
  const certificateLinks = getCertificateLinks({
    code: certificate.code,
    publicUrl,
  });

  return (
    <Card aria-labelledby={titleId} role="article">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            aria-label={`Status: ${viewModel.statusLabel}`}
            variant={viewModel.badgeVariant}
          >
            {viewModel.statusLabel}
          </Badge>
          <CardDescription>
            Emitido em {formatDate(certificate.issuedAt)}
          </CardDescription>
        </div>
        <CardTitle as="h2" id={titleId}>
          <Link href={certificateLinks.publicHref}>
            {certificate.courseTitle}
          </Link>
        </CardTitle>
        <CardDescription
          aria-label={`Código do certificado: ${certificate.code}`}
          className="font-mono text-xs"
        >
          {certificate.code}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Titular</dt>
            <dd className="font-medium">{certificate.studentName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Carga horária</dt>
            <dd className="font-medium">{certificate.workloadHours} horas</dd>
          </div>
        </dl>

        {viewModel.alert ? (
          <Alert
            role={viewModel.kind === "preparing" ? "status" : "alert"}
            variant={viewModel.alert.variant}
          >
            <AlertTitle>{viewModel.alert.title}</AlertTitle>
            <AlertDescription>{viewModel.alert.description}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 border-t">
        {viewModel.canDownload ? (
          <Button asChild>
            <Link
              aria-label={`Baixar PDF de ${certificate.courseTitle}`}
              href={certificateLinks.privatePdfHref}
            >
              <HugeiconsIcon data-icon="inline-start" icon={Download01Icon} />
              Baixar PDF
            </Link>
          </Button>
        ) : null}
        {viewModel.showSupportAction ? (
          <SupportRequestDialog
            courseTitle={certificate.courseTitle}
            triggerLabel="Falar com suporte"
          />
        ) : null}
        {viewModel.kind === "preparing" ? (
          <PendingCertificateRefresh enabled={false} showManualRefresh />
        ) : null}
        <CertificateCopyLinkButton publicUrl={certificateLinks.publicUrl} />
      </CardFooter>
    </Card>
  );
}
