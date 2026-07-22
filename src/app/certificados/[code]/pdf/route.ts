import { notFound } from "next/navigation";
import { consumePublicCertificateLookup } from "@/features/certificates/public-rate-limit";

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) => {
  await params;
  const limit = await consumePublicCertificateLookup(request.headers);

  if (limit === "limited") {
    notFound();
  }
  notFound();
};
