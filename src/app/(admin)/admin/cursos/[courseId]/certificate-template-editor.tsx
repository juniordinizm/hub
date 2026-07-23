"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    return "Substituída";
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="border-b pb-4">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-xl">Certificado</h2>
          <Badge variant={certificateEnabled ? "default" : "secondary"}>
            {state}
          </Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          Uma versão publicada por curso. A arte, os dados e o PDF ficam
          congelados no momento da emissão.
        </p>
      </div>

      <CertificateTemplateForm
        courseId={courseId}
        issuerConfigured={issuerConfigured}
        template={editable}
      />

      {templates.length > 0 ? (
        <div className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold text-xl">Histórico de versões</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Versões anteriores continuam como evidência dos certificados
            emitidos.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {templates.map((template) => (
              <div
                className="flex items-center justify-between gap-4 rounded-md border bg-background/35 px-3 py-2 text-sm"
                key={`${template.version}-${template.status}`}
              >
                <span>Versão {template.version}</span>
                <Badge
                  variant={
                    template.status === "published" ? "default" : "secondary"
                  }
                >
                  {statusLabel(template.status)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {certificateEnabled ? (
        <form action={disableCertificateForCourseAction.bind(null, courseId)}>
          <Button type="submit" variant="outline">
            Desligar certificado neste curso
          </Button>
        </form>
      ) : null}
    </section>
  );
}
