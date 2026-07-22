export interface CertificateTemplateActionState {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "error" | "idle" | "success";
}

export const certificateTemplateInitialActionState: CertificateTemplateActionState =
  { status: "idle" };
