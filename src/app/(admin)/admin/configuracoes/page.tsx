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
import { formatDate } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage(): Promise<React.JSX.Element> {
  const data = await getAdminManagementData();

  return (
    <div className="space-y-8">
      <header>
        <Badge variant="outline">Configuracoes</Badge>
        <h1 className="mt-3 font-bold text-3xl tracking-tight">
          Configuracoes globais
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
          Ajustes operacionais compartilhados por todo o Hub.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Dados operacionais</CardTitle>
            <CardDescription>
              WhatsApp, assinatura de certificado e referência AbacatePay.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveSettingsAction}>
              <FieldGroup>
                <Field>
                  <FieldLabel>WhatsApp global</FieldLabel>
                  <Input
                    defaultValue={data.settings.supportWhatsappUrl ?? ""}
                    name="supportWhatsappUrl"
                  />
                </Field>
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
                <Field>
                  <FieldLabel>Ultimos 4 caracteres AbacatePay</FieldLabel>
                  <Input
                    defaultValue={
                      data.settings.abacatepayWebhookSecretLast4 ?? ""
                    }
                    name="abacatepayWebhookSecretLast4"
                  />
                </Field>
                <Button type="submit">Salvar configuracoes</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auditoria</CardTitle>
            <CardDescription>Últimas ações administrativas.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.auditLogs.length ? (
              data.auditLogs.map((log) => (
                <div
                  className="rounded-lg border p-3"
                  key={`${log.action}-${log.createdAt.toISOString()}`}
                >
                  <p className="font-medium text-sm">{log.action}</p>
                  <p className="text-muted-foreground text-xs">
                    {log.actorEmail ?? "sistema"} - {log.targetType} -{" "}
                    {formatDate(log.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                Nenhum registro de auditoria ainda.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
