import { HistoryIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { FinanceHelp } from "@/components/admin/finance-help";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
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
import {
  getAdminBannersData,
  getAdminFaqData,
  getAdminSettingsData,
} from "@/features/admin/server";
import { requirePermission } from "@/lib/auth-permissions";
import { formatDateTime } from "@/lib/formatters";
import { route } from "@/lib/routes";
import { BannerGallery } from "./banners/banner-gallery";
import {
  CertificateSettingsForm,
  type CertificateSettingsFormValues,
} from "./certificate-settings-form";
import { FaqCreateDialog } from "./faq/faq-dialogs";
import { FaqTable } from "./faq/faq-table";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage(): Promise<React.JSX.Element> {
  await requirePermission("manageSettings");

  const [data, bannersData, faqData] = await Promise.all([
    getAdminSettingsData(),
    getAdminBannersData(),
    getAdminFaqData(),
  ]);

  const sortedBanners = [...bannersData.banners].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  const sortedFaqs = [...faqData.faqs].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  const nextSortOrder =
    sortedFaqs.length > 0
      ? Math.max(...sortedFaqs.map((f) => f.sortOrder)) + 1
      : 1;
  const issuerProfileReady = data.settings.issuerProfileComplete;
  const issuerProfileIssueLabels = {
    cnpj_invalid: "CNPJ inválido",
    cnpj_missing: "CNPJ",
    display_name_missing: "marca exibida",
    legal_name_missing: "razão social",
  } as const;
  const issuerProfileIssues = data.settings.issuerProfileIssues.map(
    (issue) => issuerProfileIssueLabels[issue]
  );
  const lastUpdatedBy =
    data.settings.lastUpdatedBy?.name ??
    data.settings.lastUpdatedBy?.email ??
    "Sistema";
  const certificateSettings: CertificateSettingsFormValues = {
    certificateSignerName: data.settings.certificateSignerName,
    certificateSignerRole: data.settings.certificateSignerRole,
    issuerCnpj: data.settings.issuerCnpj,
    issuerDisplayName: data.settings.issuerDisplayName,
    issuerLegalName: data.settings.issuerLegalName,
  };

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader
          description="Gerencie a identidade dos Certificados e o conteúdo compartilhado no Hub."
          title="Configurações globais"
        />

        <section aria-labelledby="settings-certificates" className="grid gap-4">
          <div className="flex items-center gap-2">
            <h2 className="type-section-title" id="settings-certificates">
              Emissão de certificados
            </h2>
            <FinanceHelp
              description="Configure a identidade global usada para novas emissões. Um Curso pode definir uma assinatura própria, e Certificados já emitidos permanecem imutáveis."
              details={[
                "Razão social e CNPJ formam o perfil emissor e precisam ser preenchidos juntos.",
                "A marca exibida aparece no documento quando o template não define outro valor.",
                "A assinatura padrão é usada apenas quando o Curso não possui uma assinatura própria.",
              ]}
              title="Como funciona a emissão"
            />
          </div>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle as="h2" className="text-base">
                    Perfil e assinatura
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Dados globais usados como base nos Certificados da
                    plataforma.
                  </CardDescription>
                  {issuerProfileReady ? null : (
                    <p className="mt-2 text-sm text-warning">
                      Pendências: {issuerProfileIssues.join(", ")}.
                    </p>
                  )}
                </div>
                <Badge variant={issuerProfileReady ? "success" : "warning"}>
                  {issuerProfileReady ? "Perfil pronto" : "Perfil incompleto"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <CertificateSettingsForm settings={certificateSettings} />
            </CardContent>
            <CardFooter className="flex-col items-start gap-3 border-t text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2">
                <HugeiconsIcon
                  aria-hidden="true"
                  className="mt-0.5 shrink-0"
                  icon={HistoryIcon}
                  size={16}
                  strokeWidth={2}
                />
                <p className="type-meta min-w-0">
                  {data.settings.lastUpdatedAt ? (
                    <>
                      Última alteração em{" "}
                      <time
                        dateTime={data.settings.lastUpdatedAt.toISOString()}
                      >
                        {formatDateTime(data.settings.lastUpdatedAt)}
                      </time>{" "}
                      por{" "}
                      <span className="text-foreground">{lastUpdatedBy}</span>
                    </>
                  ) : (
                    "Ainda não há alterações registradas na Auditoria."
                  )}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={route("/admin/auditoria?target=settings")}>
                  Ver histórico
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </section>

        <section aria-labelledby="settings-editorial" className="grid gap-4">
          <div className="flex items-center gap-2">
            <h2 className="type-section-title" id="settings-editorial">
              Conteúdo editorial
            </h2>
            <FinanceHelp
              description="Gerencie conteúdos compartilhados na área do Aluno. As alterações ficam disponíveis depois que forem salvas."
              details={[
                "Banners aparecem no Dashboard e podem ser reordenados por arraste ou teclado.",
                "Perguntas frequentes aparecem na área do Aluno e podem ser publicadas ou ocultadas.",
              ]}
              title="Como gerenciar conteúdo editorial"
            />
          </div>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle as="h2" className="text-base">
                Banners do Dashboard
              </CardTitle>
              <CardDescription className="mt-1">
                Até cinco banners cadastrados para a página inicial da área do
                Aluno.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BannerGallery initialBanners={sortedBanners} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle as="h2" className="text-base">
                    Perguntas frequentes
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Respostas publicadas na área do Aluno.
                  </CardDescription>
                </div>
                <FaqCreateDialog nextSortOrder={nextSortOrder} />
              </div>
            </CardHeader>
            <CardContent>
              <FaqTable faqs={sortedFaqs} />
            </CardContent>
          </Card>
        </section>
      </div>
    </PageContainer>
  );
}
