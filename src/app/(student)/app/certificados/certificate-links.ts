import type { Route } from "next";
import { route } from "@/lib/routes";

export interface CertificateLinks {
  pdfHref: Route;
  publicHref: Route;
  publicUrl: string;
}

export const getCertificateLinks = ({
  code,
  publicUrl,
}: {
  code: string;
  publicUrl: string;
}): CertificateLinks => {
  const encodedCode = encodeURIComponent(code);
  const publicHref = route(`/certificados/${encodedCode}`);

  return {
    pdfHref: route(`/certificados/${encodedCode}/pdf`),
    publicHref,
    publicUrl: new URL(publicHref, publicUrl).toString(),
  };
};
