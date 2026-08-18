import { getE2eCertificateEmailDeliveries } from "@/features/email/e2e-delivery-sink";
import { isIsolatedE2eRuntime } from "@/lib/env";

export const dynamic = "force-dynamic";

export const GET = (): Response => {
  if (!isIsolatedE2eRuntime(process.env)) {
    return new Response("Not Found", { status: 404 });
  }

  return Response.json({
    deliveries: getE2eCertificateEmailDeliveries(),
  });
};
