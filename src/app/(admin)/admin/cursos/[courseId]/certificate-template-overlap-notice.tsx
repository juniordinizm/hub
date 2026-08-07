import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { CertificateTemplateOverlap } from "@/features/certificates/template-rules";
import { certificateTemplateFieldLabels } from "./certificate-template-field-labels";

export function CertificateTemplateOverlapNotice({
  overlaps,
}: {
  overlaps: CertificateTemplateOverlap[];
}): React.JSX.Element | null {
  if (overlaps.length === 0) {
    return null;
  }

  return (
    <Alert
      aria-live="polite"
      className="mt-4 border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
      role="status"
    >
      <AlertTitle>
        {overlaps.length} sobreposição{overlaps.length === 1 ? "" : "ões"}{" "}
        detectada{overlaps.length === 1 ? "" : "s"}
      </AlertTitle>
      <AlertDescription>
        <p>
          Isso não impede salvar ou publicar. Confirme que a sobreposição é
          intencional:
        </p>
        <ul className="mt-2 list-disc pl-5">
          {overlaps.map(({ fields }) => (
            <li key={fields.join(":")}>
              {certificateTemplateFieldLabels[fields[0]]} e{" "}
              {certificateTemplateFieldLabels[fields[1]]}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
