export class CertificateTemplateDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CertificateTemplateDomainError";
  }
}

export class CertificateTemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CertificateTemplateValidationError";
  }
}
