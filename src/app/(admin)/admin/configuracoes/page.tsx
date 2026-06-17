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

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage(): Promise<React.JSX.Element> {
  const data = await getAdminManagementData();

  return (
    <main className="px-6 py-8 sm:px-10 lg:px-12">
      <div className="space-y-8">
        <header>
          <Badge variant="outline">Configurações</Badge>
          <h1 className="mt-3 font-bold text-3xl tracking-tight">
            Configurações globais
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            Ajustes operacionais compartilhados por todo o Hub.
          </p>
        </header>

        <section className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Dados operacionais</CardTitle>
              <CardDescription>
                WhatsApp global e assinatura de certificado.
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
