import { describe, expect, it } from "vitest";
import { handleE2eAsaasRequest } from "./e2e-asaas";

describe("E2E Asaas server", () => {
  it("derives a deterministic checkout from the order reference", async () => {
    const response = await handleE2eAsaasRequest(
      new Request("http://127.0.0.1:4570/v3/checkouts", {
        body: JSON.stringify({
          externalReference: "order_00000000-0000-4000-8000-000000000001",
        }),
        method: "POST",
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "chk_00000000-0000-4000-8000-000000000001",
      link: "http://127.0.0.1:4570/checkout/chk_00000000-0000-4000-8000-000000000001",
      status: "ACTIVE",
    });
  });

  it("exposes only the fixture customer contract", async () => {
    const response = await handleE2eAsaasRequest(
      new Request("http://127.0.0.1:4570/v3/customers/cus_e2e")
    );

    expect(await response.json()).toEqual({
      email: "buyer-e2e@example.test",
      id: "cus_e2e",
      name: "Buyer E2E",
    });
    expect(
      (
        await handleE2eAsaasRequest(
          new Request("http://127.0.0.1:4570/v3/customers/unknown")
        )
      ).status
    ).toBe(404);
  });

  it("derives an isolated buyer from a checkout attempt", async () => {
    const attemptId = "00000000-0000-4000-8000-000000000001";
    const response = await handleE2eAsaasRequest(
      new Request(`http://127.0.0.1:4570/v3/customers/cus_e2e_${attemptId}`)
    );

    expect(await response.json()).toEqual({
      email: "buyer-00000000000040008000000000000001@example.test",
      id: `cus_e2e_${attemptId}`,
      name: "Buyer E2E",
    });
  });

  it.each([
    [
      "cus_blocked_run123",
      {
        email: "sbrun123@example.com",
        id: "cus_blocked_run123",
        name: "Buyer Blocked E2E",
      },
    ],
    [
      "cus_team_run123",
      {
        email: "adrun123@example.com",
        id: "cus_team_run123",
        name: "Buyer Team E2E",
      },
    ],
  ])("resolves the safe collision fixture %s", async (customerId, expected) => {
    const response = await handleE2eAsaasRequest(
      new Request(`http://127.0.0.1:4570/v3/customers/${customerId}`)
    );

    expect(await response.json()).toEqual(expected);
  });
});
