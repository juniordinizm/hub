import { FloppyDiskIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import {
  AdminMutationForm,
  AdminMutationSubmitButton,
} from "@/components/admin-mutation-form";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveSettingsAction } from "@/features/admin/actions";
import {
  getAdminBannersData,
  getAdminFaqData,
  getAdminSettingsData,
} from "@/features/admin/server";
import { JMVSTREAM_PORTAL_URL } from "@/features/jmvstream/portal";
import { getJmvstreamHealthSummary } from "@/features/jmvstream/server";
import { requirePermission } from "@/lib/auth-permissions";
import { BannerGallery } from "./banners/banner-gallery";
import { FaqCreateDialog } from "./faq/faq-dialogs";
import { FaqTable } from "./faq/faq-table";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage(): Promise<React.JSX.Element> {
  await requirePermission("manageSettings");

  const [data, jmvstreamHealth, bannersData, faqData] = await Promise.all([
    getAdminSettingsData(),
    getJmvstreamHealthSummary(),
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

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader
          description="Ajustes operacionais compartilhados por todo o Hub."
          title="Configurações globais"
        />

        <section className="grid gap-4">
          <Card>
            <CardHeader className="border-b bg-muted/20 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle as="h2" className="text-base">
                    JMVStream
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {jmvstreamHealth.message}
                  </CardDescription>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={JMVSTREAM_PORTAL_URL}
                    rel="noopener"
                    target="_blank"
                  >
                    Abrir portal JMVStream
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
                <HealthTile
                  label="Uploads ativos"
                  value={jmvstreamHealth.processingUploads}
                />
                <HealthTile
                  label="Uploads com falha"
                  value={jmvstreamHealth.failedUploads}
                />
                <HealthTile
                  label="Exclusões pendentes"
                  value={jmvstreamHealth.pendingDeletes}
                />
                <HealthTile
                  label="Exclusões com falha"
                  value={jmvstreamHealth.failedDeletes}
                />
              </div>
              {jmvstreamHealth.auth === "error" ? (
                <p className="border-t p-4 text-destructive text-sm">
                  A conexão com a JMVStream precisa de revisão. Os estados
                  locais continuam disponíveis para diagnóstico.
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-4">
              <CardTitle as="h2" className="text-base">
                Dados operacionais
              </CardTitle>
              <CardDescription className="mt-1">
                Assinatura usada nos certificados emitidos pela plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminMutationForm action={saveSettingsAction}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="issuer-legal-name">
                      Razão social emissora
                    </FieldLabel>
                    <Input
                      defaultValue={data.settings.issuerLegalName ?? ""}
                      id="issuer-legal-name"
                      name="issuerLegalName"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="issuer-display-name">
                      Marca exibida
                    </FieldLabel>
                    <Input
                      defaultValue={data.settings.issuerDisplayName ?? ""}
                      id="issuer-display-name"
                      name="issuerDisplayName"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="issuer-cnpj">CNPJ emissor</FieldLabel>
                    <Input
                      defaultValue={data.settings.issuerCnpj ?? ""}
                      id="issuer-cnpj"
                      name="issuerCnpj"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="certificate-signer-name">
                      Nome da assinatura
                    </FieldLabel>
                    <Input
                      defaultValue={data.settings.certificateSignerName ?? ""}
                      id="certificate-signer-name"
                      name="certificateSignerName"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="certificate-signer-role">
                      Cargo da assinatura
                    </FieldLabel>
                    <Input
                      defaultValue={data.settings.certificateSignerRole ?? ""}
                      id="certificate-signer-role"
                      name="certificateSignerRole"
                    />
                  </Field>
                  <AdminMutationSubmitButton type="submit">
                    <HugeiconsIcon
                      aria-hidden="true"
                      data-icon="inline-start"
                      icon={FloppyDiskIcon}
                      size={18}
                      strokeWidth={2}
                    />
                    Salvar configurações
                  </AdminMutationSubmitButton>
                </FieldGroup>
              </AdminMutationForm>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-4">
              <CardTitle as="h2" className="text-base">
                Banners do dashboard
              </CardTitle>
              <CardDescription className="mt-1">
                Configure os banners rotativos exibidos na página inicial da
                área da aluna. Arraste para reordenar. (Máx. 5 imagens)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BannerGallery initialBanners={sortedBanners} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle as="h2" className="text-base">
                    Perguntas frequentes
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Conteúdo exibido na área da aluna para reduzir dúvidas
                    operacionais.
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

function HealthTile({
  label,
  value,
}: {
  label: string;
  value: number;
}): React.JSX.Element {
  return (
    <div className="flex flex-col justify-center p-5">
      <p className="font-medium text-muted-foreground text-xs">{label}</p>
      <p className="mt-1.5 font-bold text-2xl tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}
