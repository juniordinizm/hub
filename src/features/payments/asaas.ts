export const ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS = 1000;

export interface AsaasCustomer {
  email: string;
  id: string;
  name: string;
}

export interface AsaasCheckout {
  id: string;
  link: string;
  status: string;
}

export interface CreateAsaasCheckout {
  callback: {
    cancelUrl: string;
    expiredUrl: string;
    successUrl: string;
  };
  expirationMinutes: number;
  externalReference: string;
  item: {
    description: string;
    name: string;
    valueInCents: number;
  };
}

export interface AsaasRefundEvidence {
  dateCreated: string;
  endToEndIdentifier?: string;
  status: string;
  transactionReceiptUrl?: string;
  valueInCents: number;
}

export interface AsaasPayment {
  billingType: string;
  checkoutSession: string | null;
  customer: string;
  externalReference: string | null;
  id: string;
  netValueInCents: number;
  refunds: AsaasRefundEvidence[];
  status: string;
  transactionReceiptUrl?: string;
  valueInCents: number;
}

export interface ListAsaasPayments {
  checkoutSession?: string;
  externalReference?: string;
  limit?: number;
  offset?: number;
}

export interface ListAsaasFinancialTransactions {
  finishDate: string;
  limit?: number;
  offset?: number;
  order?: "asc" | "desc";
  startDate: string;
}

export interface AsaasFinancialTransaction {
  date: string;
  id: string;
  type: string;
  valueInCents: number;
}

export interface AsaasFinancialTransactionPage {
  data: AsaasFinancialTransaction[];
  hasMore: boolean;
  limit: number;
  object: string;
  offset: number;
  totalCount: number;
}

export interface AsaasPaymentPage {
  data: AsaasPayment[];
  hasMore: boolean;
  limit: number;
  object: string;
  offset: number;
  totalCount: number;
}

export interface RefundAsaasPayment {
  description: string;
  paymentId: string;
}

export interface AsaasGateway {
  cancelCheckout(checkoutId: string): Promise<AsaasCheckout>;
  createCheckout(input: CreateAsaasCheckout): Promise<AsaasCheckout>;
  getCustomer(customerId: string): Promise<AsaasCustomer>;
  getPayment(paymentId: string): Promise<AsaasPayment>;
  listFinancialTransactions(
    filters: ListAsaasFinancialTransactions
  ): Promise<AsaasFinancialTransactionPage>;
  listPayments(filters: ListAsaasPayments): Promise<AsaasPaymentPage>;
  refundPayment(input: RefundAsaasPayment): Promise<AsaasPayment>;
}
