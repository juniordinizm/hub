import type {
  AsaasCheckout,
  AsaasFinancialTransactionPage,
  AsaasGateway,
  AsaasPayment,
  AsaasPaymentPage,
  CreateAsaasCheckout,
  ListAsaasFinancialTransactions,
  ListAsaasPayments,
  RefundAsaasPayment,
} from "./asaas";

type FakeOutcome<T> = Error | T;

interface FakeAsaasGatewayConfig {
  cancelCheckout?: FakeOutcome<AsaasCheckout>;
  createCheckout?: FakeOutcome<AsaasCheckout>;
  getPayment?: FakeOutcome<AsaasPayment>;
  listFinancialTransactions?: FakeOutcome<AsaasFinancialTransactionPage>;
  listPayments?: FakeOutcome<AsaasPaymentPage>;
  refundPayment?: FakeOutcome<AsaasPayment>;
}

interface FakeAsaasGatewayCalls {
  cancelCheckout: string[];
  createCheckout: CreateAsaasCheckout[];
  getPayment: string[];
  listFinancialTransactions: ListAsaasFinancialTransactions[];
  listPayments: ListAsaasPayments[];
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
    getPayment: [],
    listFinancialTransactions: [],
    listPayments: [],
    refundPayment: [],
  };

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

  async getPayment(paymentId: string): Promise<AsaasPayment> {
    this.calls.getPayment.push(paymentId);
    return await resolveOutcome("getPayment", this.config.getPayment);
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
}
