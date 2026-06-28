import { getAuth } from "@/lib/auth";
import { isBlockedAuthEndpoint } from "@/lib/auth-policy";
import { getServerEnv } from "@/lib/env";

interface AuthRouteContext {
  params: Promise<{ all?: string[] }>;
}

export const GET = (request: Request): Promise<Response> =>
  getAuth().handler(request);

export const POST = async (
  request: Request,
  context: AuthRouteContext
): Promise<Response> => {
  const env = getServerEnv();
  const { all = [] } = await context.params;

  if (
    isBlockedAuthEndpoint({
      allowPublicSignUp: env.AUTH_PUBLIC_SIGNUP_ENABLED,
      method: request.method,
      pathSegments: all,
    })
  ) {
    return Response.json({ error: "public_sign_up_disabled" }, { status: 404 });
  }

  return getAuth().handler(request);
};
