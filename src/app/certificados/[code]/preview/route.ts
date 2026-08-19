import { getCertificatePreviewReadUrl } from "@/features/certificates/preview-server";
import { consumePublicCertificateLookup } from "@/features/certificates/public-rate-limit";

const PRIVATE_ERROR_HEADERS = {
  "cache-control": "no-store",
  "retry-after": "60",
};

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
): Promise<Response> => {
  const { code } = await params;
  const limit = await consumePublicCertificateLookup(request.headers);
  if (limit === "limited") {
    return notFoundResponse();
  }

  try {
    const signedUrl = await getCertificatePreviewReadUrl(code);
    if (!signedUrl) {
      return notFoundResponse();
    }
    return new Response(null, {
      headers: {
        "content-disposition": "inline",
        "content-type": "image/png",
        location: signedUrl,
        "x-robots-tag": "noindex, nofollow",
      },
      status: 307,
    });
  } catch {
    return unavailableResponse();
  }
};
