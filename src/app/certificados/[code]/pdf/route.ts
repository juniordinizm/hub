import { notFound } from "next/navigation";
import {
  getCertificateByCode,
  renderCertificatePdf,
} from "@/features/certificates/server";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) => {
  const { code } = await params;
  const certificate = await getCertificateByCode(code);

  if (!certificate) {
    notFound();
  }

  const pdf = await renderCertificatePdf(certificate);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Disposition": `inline; filename="${certificate.code}.pdf"`,
      "Content-Type": "application/pdf",
    },
  });
};
