import { NextResponse } from "next/server";
import {
  assertCheckoutAvailable,
  CheckoutUnavailableError,
} from "@/features/payments/checkout-availability";
import {
  createPublicCourseCheckout,
  PublicCheckoutRateLimitError,
} from "@/features/payments/public-checkout";
import { getClientIpAddress } from "@/lib/client-ip";
import { getServerEnv } from "@/lib/env";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
} from "@/lib/observability";
import { observeOperation } from "@/lib/observe-operation";

const readOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

export const POST = async (request: Request): Promise<NextResponse> => {
  const environment = getServerEnv();

  try {
    assertCheckoutAvailable({
      entry: "public",
      mode: environment.PAYMENTS_CHECKOUT_MODE,
    });
  } catch (error) {
    if (!(error instanceof CheckoutUnavailableError)) {
      throw error;
    }

    return NextResponse.json(
      { error: "Servico de checkout indisponivel." },
      { status: 503 }
    );
  }
  const correlationId = createCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER)
  );
  const body = (await request.json().catch(() => null)) as {
    courseId?: unknown;
    courseSlug?: unknown;
  } | null;
  const courseId = readOptionalString(body?.courseId);
  const courseSlug = readOptionalString(body?.courseSlug);

  try {
    const checkout = await observeOperation({
      ...(courseId ? { aggregateId: courseId } : {}),
      correlationId,
      execute: () =>
        createPublicCourseCheckout({
          ...(courseId ? { courseId } : {}),
          ...(courseSlug ? { courseSlug } : {}),
          ipAddress: getClientIpAddress(
            request.headers,
            environment.CLIENT_IP_SOURCE
          ),
        }),
      failureErrorCode: "checkout_create_failed",
      operation: "checkout.create",
      provider: "abacatepay",
    });

    return NextResponse.json(checkout);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel iniciar o checkout.",
      },
      { status: error instanceof PublicCheckoutRateLimitError ? 429 : 400 }
    );
  }
};
