import type { AsaasCustomerReference, CreateAsaasCustomer } from "./asaas";
import { AsaasGatewayError } from "./asaas-client";

export type AsaasCustomerMappingStatus =
  | "creating"
  | "failed"
  | "pending"
  | "ready"
  | "uncertain";

export interface AsaasCustomerMapping {
  externalReference: string;
  id: string;
  providerCustomerId: string | null;
  status: AsaasCustomerMappingStatus;
}

export interface AsaasCustomerMappingRepository {
  claimCreating(id: string): Promise<boolean>;
  markFailed(id: string): Promise<void>;
  markReady(
    id: string,
    providerCustomerId: string
  ): Promise<AsaasCustomerMapping>;
  markUncertain(id: string): Promise<void>;
  read(id: string): Promise<AsaasCustomerMapping | null>;
  reserve(input: {
    fingerprint: string;
    normalizedEmail: string;
  }): Promise<AsaasCustomerMapping>;
}

export interface AsaasCustomerResolutionGateway {
  createCustomer(input: CreateAsaasCustomer): Promise<AsaasCustomerReference>;
  listCustomers(input: {
    externalReference: string;
  }): Promise<{ data: AsaasCustomerReference[] }>;
}

export type AsaasCustomerResolution =
  | { providerCustomerId: string; status: "ready" }
  | { status: "processing" };

const resolveProviderMatch = ({
  customers,
  externalReference,
  normalizedEmail,
}: {
  customers: AsaasCustomerReference[];
  externalReference: string;
  normalizedEmail: string;
}): AsaasCustomerReference | null => {
  const exact = customers.filter(
    (customer) =>
      customer.externalReference === externalReference &&
      customer.email.trim().toLowerCase() === normalizedEmail
  );
  if (exact.length > 1) {
    throw new Error("Mais de um cliente Asaas corresponde a identidade.");
  }
  return exact[0] ?? null;
};

export const resolveAsaasCustomer = async ({
  cpfCnpj,
  fingerprint,
  gateway,
  name,
  normalizedEmail,
  repository,
}: {
  cpfCnpj: string;
  fingerprint: string;
  gateway: AsaasCustomerResolutionGateway;
  name: string;
  normalizedEmail: string;
  repository: AsaasCustomerMappingRepository;
}): Promise<AsaasCustomerResolution> => {
  const mapping = await repository.reserve({
    fingerprint,
    normalizedEmail,
  });
  if (mapping.status === "ready" && mapping.providerCustomerId) {
    return {
      providerCustomerId: mapping.providerCustomerId,
      status: "ready",
    };
  }
  const claimed = await repository.claimCreating(mapping.id);
  if (!claimed) {
    const current = await repository.read(mapping.id);
    return current?.status === "ready" && current.providerCustomerId
      ? { providerCustomerId: current.providerCustomerId, status: "ready" }
      : { status: "processing" };
  }

  try {
    const listed = await gateway.listCustomers({
      externalReference: mapping.externalReference,
    });
    const recovered = resolveProviderMatch({
      customers: listed.data,
      externalReference: mapping.externalReference,
      normalizedEmail,
    });
    const customer =
      recovered ??
      (await gateway.createCustomer({
        cpfCnpj,
        email: normalizedEmail,
        externalReference: mapping.externalReference,
        name,
      }));
    const ready = await repository.markReady(mapping.id, customer.id);
    return ready.providerCustomerId
      ? { providerCustomerId: ready.providerCustomerId, status: "ready" }
      : { status: "processing" };
  } catch (error) {
    if (error instanceof AsaasGatewayError && error.outcome === "unknown") {
      await repository.markUncertain(mapping.id);
      return { status: "processing" };
    }
    await repository.markFailed(mapping.id);
    throw error;
  }
};
