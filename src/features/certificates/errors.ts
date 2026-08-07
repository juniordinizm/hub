export class CertificateDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CertificateDomainError";
  }
}
