import type { StagedAdminImageReference } from "@/features/storage/staged-image-upload";

export const applyCertificateTemplateUploads = (
  formData: FormData,
  {
    background,
    signature,
  }: {
    background: StagedAdminImageReference | null;
    signature: StagedAdminImageReference | null;
  }
): void => {
  formData.delete("background");
  formData.delete("signature");
  formData.delete("backgroundUpload");
  formData.delete("signatureUpload");

  if (background) {
    formData.set("backgroundUpload", JSON.stringify(background));
  }
  if (signature) {
    formData.set("signatureUpload", JSON.stringify(signature));
  }
};
