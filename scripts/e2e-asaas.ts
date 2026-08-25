const HOSTNAME = "127.0.0.1";
const PORT = 4570;
const BASE_URL = `http://${HOSTNAME}:${PORT}`;
const COLLISION_CUSTOMER_PATH =
  /^\/v3\/customers\/cus_(blocked|team)_([a-z0-9]+)$/i;
const ISOLATED_CUSTOMER_PATH =
  /^\/v3\/customers\/cus_e2e_([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

declare const Bun: {
  serve(options: {
    fetch: (request: Request) => Promise<Response>;
    hostname: string;
    port: number;
  }): unknown;
};

const jsonNotFound = (): Response => Response.json({}, { status: 404 });

const getCustomerResponse = (pathname: string): Response | null => {
  if (pathname === "/v3/customers/cus_e2e") {
    return Response.json({
      email: "buyer-e2e@example.test",
      id: "cus_e2e",
      name: "Buyer E2E",
    });
  }

  const attemptId = ISOLATED_CUSTOMER_PATH.exec(pathname)?.[1];
  if (attemptId) {
    return Response.json({
      email: `buyer-${attemptId.replaceAll("-", "")}@example.test`,
      id: `cus_e2e_${attemptId}`,
      name: "Buyer E2E",
    });
  }

  const collisionCustomer = COLLISION_CUSTOMER_PATH.exec(pathname);
  const kind = collisionCustomer?.[1]?.toLowerCase();
  const runId = collisionCustomer?.[2];
  if (!(runId && (kind === "blocked" || kind === "team"))) {
    return null;
  }
  return Response.json({
    email:
      kind === "blocked" ? `sb${runId}@example.com` : `ad${runId}@example.com`,
    id: `cus_${kind}_${runId}`,
    name: kind === "blocked" ? "Buyer Blocked E2E" : "Buyer Team E2E",
  });
};

export const handleE2eAsaasRequest = async (
  request: Request
): Promise<Response> => {
  const url = new URL(request.url);

  if (request.method === "POST" && url.pathname === "/v3/checkouts") {
    const body = (await request.json()) as { externalReference?: string };
    const reference = body.externalReference;
    if (!reference?.startsWith("order_")) {
      return Response.json({}, { status: 422 });
    }
    const id = `chk_${reference.slice("order_".length)}`;
    return Response.json({
      id,
      link: `${BASE_URL}/checkout/${encodeURIComponent(id)}`,
      status: "ACTIVE",
    });
  }

  if (request.method === "GET") {
    const customerResponse = getCustomerResponse(url.pathname);
    if (customerResponse) {
      return customerResponse;
    }
  }

  if (request.method === "GET" && url.pathname.startsWith("/checkout/")) {
    return new Response(
      "<!doctype html><title>Asaas E2E</title><h1>Checkout Asaas E2E</h1>",
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  return jsonNotFound();
};

if (import.meta.main) {
  Bun.serve({
    fetch: handleE2eAsaasRequest,
    hostname: HOSTNAME,
    port: PORT,
  });
}
