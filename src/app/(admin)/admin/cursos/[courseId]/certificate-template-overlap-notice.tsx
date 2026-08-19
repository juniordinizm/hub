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

  const overlapLabels = overlaps.map(({ fields }) =>
    fields.map((field) => certificateTemplateFieldLabels[field]).join(" + ")
  );

  return (
    <div
      aria-live="polite"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-amber-500/8 px-3 py-2 text-muted-foreground text-xs"
      role="status"
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-amber-500"
      />
      <span>Sobreposição: {overlapLabels.join(" · ")}</span>
    </div>
  );
}
