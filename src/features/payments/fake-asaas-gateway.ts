import type {
  AsaasCheckout,
  AsaasCustomer,
  AsaasFinancialTransactionPage,
  AsaasGateway,
  AsaasInstallment,
  AsaasPayment,
  AsaasPaymentPage,
  CreateAsaasCheckout,
  ListAsaasFinancialTransactions,
  ListAsaasPayments,
  RefundAsaasInstallment,
  RefundAsaasPayment,
} from "./asaas";
import { AsaasGatewayError } from "./asaas-client";

type FakeOutcome<T> = Error | T;

interface FakeAsaasGatewayConfig {
  cancelCheckout?: FakeOutcome<AsaasCheckout>;
  createCheckout?: FakeOutcome<AsaasCheckout>;
  getInstallment?: FakeOutcome<AsaasInstallment>;
  getPayment?: FakeOutcome<AsaasPayment>;
  listFinancialTransactions?: FakeOutcome<AsaasFinancialTransactionPage>;
  listInstallmentPayments?: FakeOutcome<AsaasPaymentPage>;
  listPayments?: FakeOutcome<AsaasPaymentPage>;
  refundInstallment?: FakeOutcome<AsaasInstallment>;
  refundPayment?: FakeOutcome<AsaasPayment>;
}

interface FakeAsaasGatewayCalls {
  cancelCheckout: string[];
  createCheckout: CreateAsaasCheckout[];
  getCustomer: string[];
  getInstallment: string[];
  getPayment: string[];
  listFinancialTransactions: ListAsaasFinancialTransactions[];
  listInstallmentPayments: string[];
  listPayments: ListAsaasPayments[];
  refundInstallment: RefundAsaasInstallment[];
  refundPayment: RefundAsaasPayment[];
}

const resolveOutcome = <T>(
  operation: keyof FakeAsaasGatewayConfig,
  outcome: FakeOutcome<T> | undefined
): T => {
  if (outcome instanceof Error) {
    throw outcome;
  }

  if (outcome === undefined) {
    throw new Error(`Fake Asaas sem resposta configurada para ${operation}.`);
  }

  return outcome;
};

export class FakeAsaasGateway implements AsaasGateway {
  readonly calls: FakeAsaasGatewayCalls = {
    cancelCheckout: [],
    createCheckout: [],
    getCustomer: [],
    getPayment: [],
    getInstallment: [],
    listFinancialTransactions: [],
    listInstallmentPayments: [],
    listPayments: [],
    refundPayment: [],
    refundInstallment: [],
  };

  readonly customers = new Map<string, AsaasCustomer>();

  private readonly config: FakeAsaasGatewayConfig;

  constructor(config: FakeAsaasGatewayConfig) {
    this.config = config;
  }

  async cancelCheckout(checkoutId: string): Promise<AsaasCheckout> {
    this.calls.cancelCheckout.push(checkoutId);
    return await resolveOutcome("cancelCheckout", this.config.cancelCheckout);
  }

  async createCheckout(input: CreateAsaasCheckout): Promise<AsaasCheckout> {
    this.calls.createCheckout.push(input);
    return await resolveOutcome("createCheckout", this.config.createCheckout);
  }

  async getCustomer(customerId: string): Promise<AsaasCustomer> {
    this.calls.getCustomer.push(customerId);
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new AsaasGatewayError({
        kind: "not_found",
        message: "Cliente fake nao encontrado.",
        outcome: "rejected",
        retryable: false,
      });
    }

    return await Promise.resolve({ ...customer });
  }

  async getPayment(paymentId: string): Promise<AsaasPayment> {
    this.calls.getPayment.push(paymentId);
    return await resolveOutcome("getPayment", this.config.getPayment);
  }

  async getInstallment(installmentId: string): Promise<AsaasInstallment> {
    this.calls.getInstallment.push(installmentId);
    return await resolveOutcome("getInstallment", this.config.getInstallment);
  }

  async listFinancialTransactions(
    filters: ListAsaasFinancialTransactions
  ): Promise<AsaasFinancialTransactionPage> {
    this.calls.listFinancialTransactions.push(filters);
    return await resolveOutcome(
      "listFinancialTransactions",
      this.config.listFinancialTransactions
    );
  }

  async listPayments(filters: ListAsaasPayments): Promise<AsaasPaymentPage> {
    this.calls.listPayments.push(filters);
    return await resolveOutcome("listPayments", this.config.listPayments);
  }

  async refundPayment(input: RefundAsaasPayment): Promise<AsaasPayment> {
    this.calls.refundPayment.push(input);
    return await resolveOutcome("refundPayment", this.config.refundPayment);
  }

  async listInstallmentPayments(
    installmentId: string
  ): Promise<AsaasPaymentPage> {
    this.calls.listInstallmentPayments.push(installmentId);
    return await resolveOutcome(
      "listInstallmentPayments",
      this.config.listInstallmentPayments
    );
  }

  async refundInstallment(
    input: RefundAsaasInstallment
  ): Promise<AsaasInstallment> {
    this.calls.refundInstallment.push(input);
    return await resolveOutcome(
      "refundInstallment",
      this.config.refundInstallment
    );
  }
}
