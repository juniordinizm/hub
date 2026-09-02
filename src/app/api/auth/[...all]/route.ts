import { getAuth } from "@/lib/auth";
import { isBlockedAuthEndpoint } from "@/lib/auth-policy";
import { getServerEnv } from "@/lib/env";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
  logOperationalEvent,
} from "@/lib/observability";

interface AuthRouteContext {
  params: Promise<{ all?: string[] }>;
}

export const GET = (request: Request): Promise<Response> =>
  getAuth().handler(request);

export const POST = async (
  request: Request,
  context: AuthRouteContext
): Promise<Response> => {
  const correlationId = createCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER)
  );
  const env = getServerEnv();
  const { all = [] } = await context.params;
  const authEndpoint = all.join("/");

  if (
    isBlockedAuthEndpoint({
      allowPublicSignUp: env.AUTH_PUBLIC_SIGNUP_ENABLED,
      method: request.method,
      pathSegments: all,
    })
  ) {
    logOperationalEvent({
      correlationId,
      errorCode: "public_signup_disabled",
      httpStatus: 404,
      operation: "auth.sign_up",
      outcome: "failure",
    });
    return Response.json({ error: "public_sign_up_disabled" }, { status: 404 });
  }

  const response = await getAuth().handler(request);
  const isSignIn = authEndpoint === "sign-in/email";

  if (isSignIn) {
    const failed = response.status >= 400;
    logOperationalEvent({
      correlationId,
      ...(failed
        ? {
            errorCode:
              response.status === 429 ? "auth_rate_limited" : "auth_failed",
          }
        : {}),
      httpStatus: response.status,
      operation: "auth.sign_in",
      outcome: failed ? "failure" : "success",
    });
  }

  return response;
};
