import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { CertificateField } from "@/features/certificates/template-rules";
import { certificateTemplateFieldLabels } from "./certificate-template-field-labels";

export function CertificateTemplateOverflowNotice({
  fields,
}: {
  fields: readonly CertificateField[];
}): React.JSX.Element | null {
  if (fields.length === 0) {
    return null;
  }

  const labels = fields.map((field) => certificateTemplateFieldLabels[field]);

  return (
    <Alert
      className="border-accent/40 bg-accent/10 text-foreground"
      data-certificate-overflow-warning="true"
      role="status"
    >
      <AlertTitle>Conteúdo fora da área do campo</AlertTitle>
      <AlertDescription className="text-foreground/80">
        {labels.join(", ")} excede o espaço com os dados de exemplo. O PDF
        manterá o recorte configurado; ajuste o campo se quiser exibir todo o
        conteúdo ou prossiga mesmo assim.
      </AlertDescription>
    </Alert>
  );
}
