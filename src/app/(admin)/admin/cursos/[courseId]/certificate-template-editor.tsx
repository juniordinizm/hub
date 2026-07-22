"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { disableCertificateForCourseAction } from "@/features/admin/actions";
import type { CertificateTemplateSpec } from "@/features/certificates/template-rules";
import {
  type CertificateTemplateEditorTemplate,
  CertificateTemplateForm,
} from "./certificate-template-form";

export function CertificateTemplateEditor({
  certificateEnabled,
  courseId,
  issuerConfigured,
  templates,
}: {
  certificateEnabled: boolean;
  courseId: string;
  issuerConfigured: boolean;
  templates: Array<
    CertificateTemplateEditorTemplate & { spec: CertificateTemplateSpec }
  >;
}): React.JSX.Element {
  const draft = templates.find((template) => template.status === "draft");
  const active = templates.find((template) => template.status === "published");
  const editable = draft ?? active;
  let state = "Desligado";
  if (draft) {
    state = "Rascunho";
  }
  if (certificateEnabled) {
    state = "Ativo";
  }
  const statusLabel = (
    status: CertificateTemplateEditorTemplate["status"]
  ): string => {
    if (status === "published") {
      return "Ativa";
    }
    if (status === "draft") {
      return "Rascunho";
    }
    return "Substituida";
  };

  return (
    <section className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Certificado{" "}
            <Badge variant={certificateEnabled ? "default" : "secondary"}>
              {state}
            </Badge>
          </CardTitle>
          <CardDescription>
            Uma versao publicada por curso. A arte, os dados e o PDF ficam
            congelados no momento da emissao.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CertificateTemplateForm
            courseId={courseId}
            issuerConfigured={issuerConfigured}
            template={editable}
          />
        </CardContent>
      </Card>
      {certificateEnabled ? (
        <form action={disableCertificateForCourseAction.bind(null, courseId)}>
          <Button type="submit" variant="outline">
            Desligar certificado neste curso
          </Button>
        </form>
      ) : null}
      {templates.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Historico de versoes</CardTitle>
            <CardDescription>
              Versoes anteriores continuam como evidencia dos certificados
              emitidos.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {templates.map((template) => (
              <div
                className="flex items-center justify-between gap-4"
                key={`${template.version}-${template.status}`}
              >
                <span>Versao {template.version}</span>
                <Badge
                  variant={
                    template.status === "published" ? "default" : "secondary"
                  }
                >
                  {statusLabel(template.status)}
                </Badge>
              </div>
            ))}
            <Separator />
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
