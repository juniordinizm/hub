export const applyCertificateTemplateFiles = (
  formData: FormData,
  { background, signature }: { background: File | null; signature: File | null }
): void => {
  formData.delete("background");
  formData.delete("signature");
  if (background) {
    formData.set("background", background);
  }
  if (signature) {
    formData.set("signature", signature);
  }
};
