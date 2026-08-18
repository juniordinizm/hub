export function CertificatePublicCode({
  code,
}: {
  code: string;
}): React.JSX.Element {
  return (
    <section
      aria-labelledby="certificate-code-heading"
      className="mt-6 border-t pt-5"
      data-certificate-code="true"
    >
      <p
        className="text-muted-foreground text-xs"
        id="certificate-code-heading"
      >
        Código do certificado
      </p>
      <p
        className="mt-1 break-all font-medium font-mono text-sm"
        translate="no"
      >
        {code}
      </p>
    </section>
  );
}
