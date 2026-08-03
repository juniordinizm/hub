import { NextResponse } from "next/server";
import { CheckoutIntentError } from "@/features/payments/checkout";
import {
  type CheckoutApiResponse,
  parseCheckoutRequest,
  parseCheckoutStatusRequest,
} from "@/features/payments/checkout-api";
import { assertCheckoutAvailable } from "@/features/payments/checkout-availability";
import { readPublicCheckoutStatus } from "@/features/payments/checkout-recovery";
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
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const unavailableResponse = (
  message: string,
  status: number,
  retryAfterSeconds?: number,
  noStore = false
): NextResponse<CheckoutApiResponse> => {
  const headers: Record<string, string> = {};
  if (noStore) {
    headers["Cache-Control"] = "no-store";
  }
  if (retryAfterSeconds !== undefined) {
    headers["Retry-After"] = String(retryAfterSeconds);
  }

  return NextResponse.json(
    {
      error: message,
      retryAllowed: false,
      status: "unavailable",
    } satisfies CheckoutApiResponse,
    {
      headers,
      status,
    }
  );
};

const statusCodeForCheckout = (checkout: CheckoutApiResponse): number => {
  if (checkout.status === "processing") {
    return 202;
  }
  if (checkout.status === "unavailable") {
    return 404;
  }
  return 200;
};

const readCheckoutEnvironment = (): ReturnType<typeof getServerEnv> | null => {
  try {
    const environment = getServerEnv();
    assertCheckoutAvailable({
      entry: "public",
      mode: environment.PAYMENTS_CHECKOUT_MODE,
    });
    return environment;
  } catch {
    return null;
  }
};

const readAllowedSession = async (): Promise<
  | Awaited<ReturnType<typeof getCurrentSession>>
  | "blocked"
  | "team"
  | "unavailable"
> => {
  try {
    const session = await getCurrentSession();
    if (session && session.role !== "student") {
      return "team";
    }
    if (session?.platformBlockedAt) {
      return "blocked";
    }
    return session;
  } catch {
    return "unavailable";
  }
};

export const GET = async (
  request: Request
): Promise<NextResponse<CheckoutApiResponse>> => {
  if (!readCheckoutEnvironment()) {
    return unavailableResponse(
      "Servico de checkout indisponivel.",
      503,
      undefined,
      true
    );
  }

  const query = parseCheckoutStatusRequest(new URL(request.url).searchParams);
  if (!query) {
    return unavailableResponse(
      "Dados de checkout invalidos.",
      400,
      undefined,
      true
    );
  }

  const session = await readAllowedSession();
  if (session === "team") {
    return unavailableResponse(
      "Apenas alunas podem consultar checkout.",
      403,
      undefined,
      true
    );
  }
  if (session === "blocked") {
    return unavailableResponse(
      "Conta bloqueada. Entre em contato com o suporte.",
      403,
      undefined,
      true
    );
  }
  if (session === "unavailable") {
    return unavailableResponse(
      "Servico de checkout indisponivel.",
      503,
      undefined,
      true
    );
  }

  try {
    const checkout = await readPublicCheckoutStatus(query);
    return NextResponse.json(checkout, {
      headers: NO_STORE_HEADERS,
      status: statusCodeForCheckout(checkout),
    });
  } catch {
    return unavailableResponse(
      "Servico de checkout indisponivel.",
      503,
      undefined,
      true
    );
  }
};

export const POST = async (
  request: Request
): Promise<NextResponse<CheckoutApiResponse>> => {
  const environment = readCheckoutEnvironment();
  if (!environment) {
    return unavailableResponse("Servico de checkout indisponivel.", 503);
  }

  const body = parseCheckoutRequest(await request.json().catch(() => null));
  if (!body) {
    return unavailableResponse("Dados de checkout invalidos.", 400);
  }

  const session = await readAllowedSession();
  if (session === "unavailable") {
    return unavailableResponse("Servico de checkout indisponivel.", 503);
  }
  if (session === "team") {
    return unavailableResponse("Apenas alunas podem iniciar checkout.", 403);
  }
  if (session === "blocked") {
    return unavailableResponse(
      "Conta bloqueada. Entre em contato com o suporte.",
      403
    );
  }

  const authenticatedBuyer = session
    ? {
        email: session.user.email,
        kind: "authenticated" as const,
        name: session.user.name,
        userId: session.user.id,
      }
    : undefined;

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
          ...(authenticatedBuyer ? { authenticatedBuyer } : {}),
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
          retryAllowed: false,
          status: "ready",
        } satisfies CheckoutApiResponse,
        { status: 200 }
      );
    }
    if (checkout.status === "processing") {
      return NextResponse.json(
        {
          orderId: checkout.orderId,
          retryAllowed: false,
          status: "processing",
        } satisfies CheckoutApiResponse,
        { status: 202 }
      );
    }
    return NextResponse.json(
      {
        orderId: checkout.orderId,
        retryAllowed: true,
        status: "failed",
      } satisfies CheckoutApiResponse,
      { status: 502 }
    );
  } catch (error) {
    if (error instanceof PublicCheckoutRateLimitError) {
      return unavailableResponse(
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
      return unavailableResponse(
        "Nao foi possivel iniciar o checkout.",
        statusByKind[error.kind]
      );
    }

    return unavailableResponse("Servico de checkout indisponivel.", 503);
  }
};
