import { FloppyDiskIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@/components/ui/badge";
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
import { getAdminManagementData } from "@/features/admin/server";
import { getJmvstreamHealthSummary } from "@/features/jmvstream/server";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage(): Promise<React.JSX.Element> {
  const [data, jmvstreamHealth] = await Promise.all([
    getAdminManagementData(),
    getJmvstreamHealthSummary(),
  ]);

  return (
    <main className="px-6 py-8 sm:px-10 lg:px-12">
      <div className="flex flex-col gap-8">
        <header className="border-b pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 space-y-1">
              <h1 className="font-bold text-3xl tracking-tight">
                Configurações globais
              </h1>
              <p className="text-muted-foreground text-sm">
                Ajustes operacionais compartilhados por todo o Hub.
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-4">
          <Card className="border-none bg-card shadow-sm ring-1 ring-border/50">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">JMVStream</CardTitle>
                  <CardDescription className="mt-1">
                    {jmvstreamHealth.message}
                  </CardDescription>
                </div>
                <Badge
                  variant={
                    jmvstreamHealth.auth === "ok" ? "default" : "destructive"
                  }
                >
                  {jmvstreamHealth.auth === "ok" ? "Conectada" : "Revisar"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
                <HealthTile
                  label="Galerias"
                  value={jmvstreamHealth.folderCount}
                />
                <HealthTile
                  label="Uploads ativos"
                  value={jmvstreamHealth.processingUploads}
                />
                <HealthTile
                  label="Uploads falhos"
                  value={jmvstreamHealth.failedUploads}
                />
                <HealthTile
                  label="Exclusoes pendentes"
                  value={jmvstreamHealth.pendingDeletes}
                />
                <HealthTile
                  label="Exclusoes falhas"
                  value={jmvstreamHealth.failedDeletes}
                />
              </div>
            </CardContent>
          </Card>
          <Card className="border-none bg-card shadow-sm ring-1 ring-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Dados operacionais</CardTitle>
              <CardDescription className="mt-1">
                Assinatura usada nos certificados emitidos pela plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={saveSettingsAction}>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Nome da assinatura</FieldLabel>
                    <Input
                      defaultValue={data.settings.certificateSignerName ?? ""}
                      name="certificateSignerName"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Cargo da assinatura</FieldLabel>
                    <Input
                      defaultValue={data.settings.certificateSignerRole ?? ""}
                      name="certificateSignerRole"
                    />
                  </Field>
                  <Button type="submit">
                    <HugeiconsIcon
                      icon={FloppyDiskIcon}
                      size={18}
                      strokeWidth={2}
                    />
                    Salvar configurações
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
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
      <p className="mt-1.5 font-bold text-2xl tracking-tight">{value}</p>
    </div>
  );
}
