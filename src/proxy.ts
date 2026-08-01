import { type NextRequest, NextResponse } from "next/server";
import { getMaintenanceRequestDecision } from "@/lib/maintenance-mode";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
} from "@/lib/observability";

export const proxy = (request: NextRequest): NextResponse => {
  const correlationId = createCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER)
  );
  const decision = getMaintenanceRequestDecision({
    maintenanceMode:
      process.env.APPLICATION_MAINTENANCE_MODE === "full" ? "full" : "off",
    method: request.method,
    pathname: request.nextUrl.pathname,
  });

  if (decision === "service-unavailable") {
    const response = NextResponse.json(
      { error: "service_unavailable" },
      { status: 503 }
    );
    response.headers.set(CORRELATION_ID_HEADER, correlationId);
    response.headers.set("Retry-After", "3600");
    return response;
  }

  if (decision === "maintenance-page") {
    const maintenanceUrl = new URL("/manutencao", request.url);
    const response = NextResponse.rewrite(maintenanceUrl, { status: 503 });
    response.headers.set(CORRELATION_ID_HEADER, correlationId);
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CORRELATION_ID_HEADER, correlationId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
};

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
