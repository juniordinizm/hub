import { NextResponse } from "next/server";
import { CheckoutIntentError } from "@/features/payments/checkout";
import { assertCheckoutAvailable } from "@/features/payments/checkout-availability";
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

export const dynamic = "force-dynamic";

interface PublicCheckoutBody {
  buyerEmail: string;
  buyerName: string;
  checkoutAttemptId: string;
  courseId?: string;
  courseSlug?: string;
}

const readBody = (value: unknown): PublicCheckoutBody | null => {
  if (!(value && typeof value === "object" && !Array.isArray(value))) {
    return null;
  }

  const body = value as Record<string, unknown>;
  const courseId =
    typeof body.courseId === "string" ? body.courseId.trim() : undefined;
  const courseSlug =
    typeof body.courseSlug === "string" ? body.courseSlug.trim() : undefined;
  const buyerEmail =
    typeof body.buyerEmail === "string" ? body.buyerEmail.trim() : "";
  const buyerName =
    typeof body.buyerName === "string" ? body.buyerName.trim() : "";
  const checkoutAttemptId =
    typeof body.checkoutAttemptId === "string"
      ? body.checkoutAttemptId.trim()
      : "";
  const allowedKeys = new Set([
    "buyerEmail",
    "buyerName",
    "checkoutAttemptId",
    courseId ? "courseId" : "courseSlug",
  ]);

  if (
    !(buyerEmail && buyerName && checkoutAttemptId) ||
    Boolean(courseId) === Boolean(courseSlug) ||
    Object.keys(body).some((key) => !allowedKeys.has(key))
  ) {
    return null;
  }

  return {
    buyerEmail,
    buyerName,
    checkoutAttemptId,
    ...(courseId ? { courseId } : {}),
    ...(courseSlug ? { courseSlug } : {}),
  };
};

const errorResponse = (
  message: string,
  status: number,
  retryAfterSeconds?: number
): NextResponse =>
  NextResponse.json(
    { error: message },
    {
      ...(retryAfterSeconds === undefined
        ? {}
        : { headers: { "Retry-After": String(retryAfterSeconds) } }),
      status,
    }
  );

export const POST = async (request: Request): Promise<NextResponse> => {
  let environment: ReturnType<typeof getServerEnv>;
  try {
    environment = getServerEnv();
    assertCheckoutAvailable({
      entry: "public",
      mode: environment.PAYMENTS_CHECKOUT_MODE,
    });
  } catch {
    return errorResponse("Servico de checkout indisponivel.", 503);
  }

  const body = readBody(await request.json().catch(() => null));
  if (!body) {
    return errorResponse("Dados de checkout invalidos.", 400);
  }

  try {
    const correlationId = createCorrelationId(
      request.headers.get(CORRELATION_ID_HEADER)
    );
    const aggregateId = body.courseId ?? body.courseSlug;
    const checkout = await observeOperation({
      ...(aggregateId ? { aggregateId } : {}),
      correlationId,
      execute: () =>
        createPublicCourseCheckout({
          ...body,
          ipAddress: getClientIpAddress(
            request.headers,
            environment.CLIENT_IP_SOURCE
          ),
        }),
      failureErrorCode: "checkout_create_failed",
      operation: "checkout.create",
      provider: "asaas",
    });

    if (checkout.status === "ready") {
      return NextResponse.json(
        {
          orderId: checkout.orderId,
          redirectUrl: checkout.redirectUrl,
          status: checkout.status,
        },
        { status: 200 }
      );
    }
    if (checkout.status === "processing") {
      return NextResponse.json(
        { orderId: checkout.orderId, status: checkout.status },
        { status: 202 }
      );
    }
    return errorResponse("Nao foi possivel iniciar o checkout.", 502);
  } catch (error) {
    if (error instanceof PublicCheckoutRateLimitError) {
      return errorResponse(
        "Muitas tentativas de checkout. Tente novamente em breve.",
        429,
        error.retryAfterSeconds
      );
    }

    if (error instanceof CheckoutIntentError) {
      const statusByKind = {
        conflict: 409,
        unavailable: 422,
        validation: 400,
      } as const;
      return errorResponse(
        "Nao foi possivel iniciar o checkout.",
        statusByKind[error.kind]
      );
    }

    return errorResponse("Servico de checkout indisponivel.", 503);
  }
};
