import { notFound } from "next/navigation";
import { consumePublicCertificateLookup } from "@/features/certificates/public-rate-limit";
import {
  getCertificateByCode,
  renderCertificatePdf,
} from "@/features/certificates/server";

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) => {
  const { code } = await params;
  const limit = await consumePublicCertificateLookup(request.headers);

  if (limit === "limited") {
    notFound();
  }
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
