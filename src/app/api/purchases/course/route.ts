import { NextResponse } from "next/server";
import { normalizeBuyerEmail } from "@/features/payments/buyer-identity";
import { InvoiceIntentPreparationError } from "@/features/payments/invoice-intent";
import { PublicCheckoutRateLimitError } from "@/features/payments/public-checkout";
import { createPublicCourseInvoicePurchase } from "@/features/payments/public-invoice-purchase";
import { readPublicInvoiceStatus } from "@/features/payments/public-invoice-recovery";
import { parsePublicPurchaseBody } from "@/features/payments/public-purchase-api";
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
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COURSE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const errorResponse = (status: number, message: string): NextResponse =>
  NextResponse.json(
    { error: message, status: "unavailable" },
    { headers: NO_STORE_HEADERS, status }
  );

const invoicePreparationErrorResponse = (
  error: InvoiceIntentPreparationError
): NextResponse => {
  switch (error.kind) {
    case "identity_ineligible":
      return errorResponse(
        403,
        "Identidade nao elegivel para compra. Entre em contato com o suporte."
      );
    case "quote_stale":
      return errorResponse(
        409,
        "A cotacao expirou ou a oferta foi alterada. Atualize a pagina."
      );
    case "conflict":
      return errorResponse(
        409,
        "Esta tentativa de compra pertence a outra oferta."
      );
    case "temporarily_unavailable":
      return errorResponse(503, "Cotacao temporariamente indisponivel.");
    default:
      return errorResponse(503, "Servico de pagamento indisponivel.");
  }
};

const readStatusCode = (status: string): number => {
  if (status === "unavailable") {
    return 404;
  }
  if (status === "processing") {
    return 202;
  }
  return 200;
};

const mutationStatusCode = (status: string): number => {
  if (status === "ready") {
    return 200;
  }
  if (status === "processing") {
    return 202;
  }
  return 502;
};

const purchaseErrorResponse = (error: unknown): NextResponse => {
  if (error instanceof PublicCheckoutRateLimitError) {
    const response = errorResponse(
      429,
      "Muitas tentativas de compra. Tente novamente em breve."
    );
    response.headers.set("Retry-After", String(error.retryAfterSeconds));
    return response;
  }
  if (error instanceof InvoiceIntentPreparationError) {
    return invoicePreparationErrorResponse(error);
  }
  return errorResponse(503, "Servico de pagamento indisponivel.");
};

export const GET = async (request: Request): Promise<NextResponse> => {
  const parameters = new URL(request.url).searchParams;
  const courseSlug = parameters.get("courseSlug");
  const purchaseAttemptId = parameters.get("purchaseAttemptId");
  if (
    parameters.size !== 2 ||
    !courseSlug ||
    !COURSE_SLUG_PATTERN.test(courseSlug) ||
    !purchaseAttemptId ||
    !UUID_PATTERN.test(purchaseAttemptId)
  ) {
    return errorResponse(400, "Dados de compra invalidos.");
  }
  try {
    const correlationId = createCorrelationId(
      request.headers.get(CORRELATION_ID_HEADER)
    );
    const result = await observeOperation({
      aggregateId: purchaseAttemptId,
      correlationId,
      execute: async () =>
        await readPublicInvoiceStatus({ courseSlug, purchaseAttemptId }),
      failureErrorCode: "invoice_recovery_failed",
      operation: "payment.invoice.recover",
      provider: "asaas",
    });
    return NextResponse.json(result, {
      headers: NO_STORE_HEADERS,
      status: readStatusCode(result.status),
    });
  } catch {
    return errorResponse(503, "Servico de pagamento indisponivel.");
  }
};

export const POST = async (request: Request): Promise<NextResponse> => {
  const input = parsePublicPurchaseBody(await request.json().catch(() => null));
  if (!input) {
    return errorResponse(400, "Dados de compra invalidos.");
  }

  try {
    const session = await getCurrentSession();
    if (session && session.role !== "student") {
      return errorResponse(403, "Conta nao elegivel para compra.");
    }
    if (session?.platformBlockedAt) {
      return errorResponse(
        403,
        "Conta bloqueada. Entre em contato com o suporte."
      );
    }
    if (session && normalizeBuyerEmail(session.user.email) !== input.email) {
      return errorResponse(403, "O e-mail deve corresponder a conta atual.");
    }
    const environment = getServerEnv();
    const correlationId = createCorrelationId(
      request.headers.get(CORRELATION_ID_HEADER)
    );
    const result = await observeOperation({
      aggregateId: input.purchaseAttemptId,
      correlationId,
      execute: async () =>
        await createPublicCourseInvoicePurchase({
          input,
          ipAddress: getClientIpAddress(
            request.headers,
            environment.CLIENT_IP_SOURCE
          ),
        }),
      failureErrorCode: "invoice_create_failed",
      operation: "payment.invoice.create",
      provider: "asaas",
    });
    const statusCode = mutationStatusCode(result.status);
    return NextResponse.json(result, {
      headers: NO_STORE_HEADERS,
      status: statusCode,
    });
  } catch (error) {
    return purchaseErrorResponse(error);
  }
};
