import {
  CertificateTemplateDomainError,
  CertificateTemplateValidationError,
} from "@/features/certificates/template-errors";

export const getExpectedCertificateTemplateActionMessage = (
  error: unknown
): string | null => {
  if (
    error instanceof CertificateTemplateDomainError ||
    error instanceof CertificateTemplateValidationError
  ) {
    return error.message;
  }

  return null;
};

export const saveAndPublishCertificateTemplate = async ({
  formData,
  publishDraft,
  saveDraft,
}: {
  formData: FormData;
  publishDraft: (courseId: string) => Promise<void>;
  saveDraft: (formData: FormData) => Promise<void>;
}): Promise<void> => {
  const courseId = String(formData.get("courseId") ?? "").trim();
  if (!courseId) {
    throw new CertificateTemplateDomainError("Curso invalido.");
  }

  await saveDraft(formData);
  await publishDraft(courseId);
};
