import { NextResponse } from "next/server";
import { getPublicCoursePaymentQuote } from "@/features/payments/public-payment-quote";
import { getClientIpAddress } from "@/lib/client-ip";
import { getServerEnv } from "@/lib/env";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
} from "@/lib/observability";
import { observeOperation } from "@/lib/observe-operation";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
const COURSE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const errorResponse = (status: number): NextResponse =>
  NextResponse.json(
    { error: "Cotacao de pagamento indisponivel." },
    { headers: NO_STORE_HEADERS, status }
  );

export const GET = async (request: Request): Promise<NextResponse> => {
  const parameters = new URL(request.url).searchParams;
  const courseSlug = parameters.get("courseSlug");
  if (
    parameters.size !== 1 ||
    !courseSlug ||
    courseSlug.length > 160 ||
    !COURSE_SLUG_PATTERN.test(courseSlug)
  ) {
    return errorResponse(400);
  }

  try {
    const environment = getServerEnv();
    const quote = await observeOperation({
      aggregateId: courseSlug,
      correlationId: createCorrelationId(
        request.headers.get(CORRELATION_ID_HEADER)
      ),
      execute: async () =>
        await getPublicCoursePaymentQuote({
          courseSlug,
          ipAddress: getClientIpAddress(
            request.headers,
            environment.CLIENT_IP_SOURCE
          ),
        }),
      failureErrorCode: "payment_quote_failed",
      operation: "payment.quote.create",
      provider: "asaas",
    });
    return NextResponse.json(quote, { headers: NO_STORE_HEADERS });
  } catch {
    return errorResponse(503);
  }
};
