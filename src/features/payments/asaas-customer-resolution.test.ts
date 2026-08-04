import { describe, expect, it, vi } from "vitest";
import { AsaasGatewayError } from "./asaas-client";
import {
  type AsaasCustomerMapping,
  type AsaasCustomerMappingRepository,
  resolveAsaasCustomer,
} from "./asaas-customer-resolution";

const mapping: AsaasCustomerMapping = {
  externalReference: "buyer_09d71750-87d5-48cf-9fe4-6c8ef6033369",
  id: "7fb3447e-2702-48f8-abe2-6c47b091bdcb",
  providerCustomerId: null,
  status: "pending",
};

describe("Asaas customer resolution", () => {
  it("recovers an existing provider customer before creating another", async () => {
    const repository: AsaasCustomerMappingRepository = {
      claimCreating: vi.fn(async () => true),
      markFailed: vi.fn(),
      markReady: vi.fn(async (_id, providerCustomerId) => ({
        ...mapping,
        providerCustomerId,
        status: "ready" as const,
      })),
      markUncertain: vi.fn(),
      read: vi.fn(async () => mapping),
      reserve: vi.fn(async () => mapping),
    };
    const gateway = {
      createCustomer: vi.fn(),
      listCustomers: vi.fn(async () => ({
        data: [
          {
            email: "buyer@example.com",
            externalReference: mapping.externalReference,
            id: "cus_asaas",
            name: "Compradora",
          },
        ],
        hasMore: false,
      })),
    };

    await expect(
      resolveAsaasCustomer({
        cpfCnpj: "39053344705",
        fingerprint: "fingerprint",
        gateway,
        name: "Compradora",
        normalizedEmail: "buyer@example.com",
        repository,
      })
    ).resolves.toEqual({ providerCustomerId: "cus_asaas", status: "ready" });
    expect(gateway.createCustomer).not.toHaveBeenCalled();
    expect(JSON.stringify(repository)).not.toContain("39053344705");
  });

  it("marks an unknown create result and never retries the mutation blindly", async () => {
    const repository: AsaasCustomerMappingRepository = {
      claimCreating: vi.fn(async () => true),
      markFailed: vi.fn(),
      markReady: vi.fn(),
      markUncertain: vi.fn(),
      read: vi.fn(async () => mapping),
      reserve: vi.fn(async () => mapping),
    };
    const gateway = {
      createCustomer: vi.fn(() =>
        Promise.reject(
          new AsaasGatewayError({
            kind: "timeout",
            message: "timeout",
            outcome: "unknown",
            retryable: false,
          })
        )
      ),
      listCustomers: vi.fn(async () => ({ data: [], hasMore: false })),
    };

    await expect(
      resolveAsaasCustomer({
        cpfCnpj: "39053344705",
        fingerprint: "fingerprint",
        gateway,
        name: "Compradora",
        normalizedEmail: "buyer@example.com",
        repository,
      })
    ).resolves.toEqual({ status: "processing" });
    expect(repository.markUncertain).toHaveBeenCalledWith(mapping.id);
    expect(gateway.createCustomer).toHaveBeenCalledOnce();
  });
});
