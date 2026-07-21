import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
  logOperationalEvent,
} from "./observability";

interface RequestErrorContext {
  routePath: string;
  routeType: string;
}

interface RequestErrorRequest {
  headers: Record<string, string | string[] | undefined>;
}

const readHeader = (
  headers: RequestErrorRequest["headers"],
  name: string
): string | null => {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return typeof value === "string" ? value : (value?.[0] ?? null);
};

export const logRequestFailure = (
  {
    context,
    request,
  }: {
    context: RequestErrorContext;
    request: RequestErrorRequest;
  },
  write?: (record: string) => void
): string => {
  const correlationId = createCorrelationId(
    readHeader(request.headers, CORRELATION_ID_HEADER)
  );

  logOperationalEvent(
    {
      correlationId,
      errorCode: "request_error",
      operation: `${context.routeType}.${context.routePath}`,
      outcome: "failure",
    },
    write
  );

  return correlationId;
};
