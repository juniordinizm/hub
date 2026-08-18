import { consumePublicCertificateLookup } from "@/features/certificates/public-rate-limit";
import { getCertificateByCode } from "@/features/certificates/server";
import {
  createR2ObjectReadUrl,
  verifyPrivateR2ObjectSha256,
} from "@/features/storage/r2";

const PRIVATE_ERROR_HEADERS = {
  "cache-control": "no-store",
  "retry-after": "60",
};
const PUBLIC_PDF_ROBOTS_HEADER = "noindex, nofollow";

const notFoundResponse = (): Response =>
  new Response(null, { headers: PRIVATE_ERROR_HEADERS, status: 404 });

const unavailableResponse = (): Response =>
  new Response(null, {
    headers: PRIVATE_ERROR_HEADERS,
    status: 503,
  });

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) => {
  const { code } = await params;
  const limit = await consumePublicCertificateLookup(request.headers);

  if (limit === "limited") {
    return notFoundResponse();
  }

  try {
    const certificate = await getCertificateByCode(code);
    if (
      certificate?.status !== "valid" ||
      certificate.renderStatus !== "ready" ||
      !certificate.pdfStorageKey ||
      !certificate.pdfSha256
    ) {
      return notFoundResponse();
    }

    const hashStatus = await verifyPrivateR2ObjectSha256({
      expectedSha256: certificate.pdfSha256,
      key: certificate.pdfStorageKey,
    });

    if (hashStatus === "missing") {
      return notFoundResponse();
    }
    if (hashStatus !== "match") {
      return unavailableResponse();
    }

    const signedUrl = await createR2ObjectReadUrl({
      key: certificate.pdfStorageKey,
      responseContentDisposition: "inline",
    });
    return new Response(null, {
      headers: {
        "content-security-policy": "frame-ancestors 'self'",
        "content-type": "application/pdf",
        location: signedUrl,
        "x-robots-tag": PUBLIC_PDF_ROBOTS_HEADER,
        "x-frame-options": "SAMEORIGIN",
      },
      status: 307,
    });
  } catch {
    return unavailableResponse();
  }
};
