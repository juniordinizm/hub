export const ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS = 1000;

export interface AsaasCustomer {
  email: string;
  id: string;
  name: string;
}

export interface AsaasCustomerReference extends AsaasCustomer {
  externalReference: string;
}

export interface AsaasCustomerPage {
  data: AsaasCustomerReference[];
  hasMore: boolean;
  limit: number;
  object: string;
  offset: number;
  totalCount: number;
}

export interface AsaasCreditCardFeeSchedule {
  discountExpiration?: string;
  oneInstallmentPercentageBasisPoints: number;
  operationFeeInCents: number;
  promotionalOneInstallmentPercentageBasisPoints?: number;
  promotionalUpToSixInstallmentsPercentageBasisPoints?: number;
  promotionalUpToTwelveInstallmentsPercentageBasisPoints?: number;
  upToSixInstallmentsPercentageBasisPoints: number;
  upToTwelveInstallmentsPercentageBasisPoints: number;
}

export interface AsaasPaymentSimulation {
  feePercentageBasisPoints: number;
  installmentAmountInCents: number;
  installmentNetAmountInCents: number;
  netAmountInCents: number;
  operationFeeInCents: number;
}

export interface SimulateAsaasPayment {
  billingType: "CREDIT_CARD";
  installmentCount: number;
  valueInCents: number;
}

export interface CreateAsaasCustomer {
  cpfCnpj: string;
  email: string;
  externalReference: string;
  name: string;
}

export interface CreateAsaasPayment {
  billingType: "CREDIT_CARD" | "PIX";
  callback?: {
    autoRedirect: boolean;
    successUrl: string;
  };
  customerId: string;
  description: string;
  dueDate: string;
  externalReference: string;
  installmentCount: number;
  totalAmountInCents: number;
}

export interface CreatedAsaasPayment {
  id: string;
  installmentId: string | null;
  invoiceUrl: string;
  status: string;
}

export interface ListAsaasCustomers {
  externalReference: string;
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
  paymentOptions: {
    allowCreditCard: boolean;
    allowPix: boolean;
    maxInstallmentCount: number;
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
  installmentId?: string;
  invoiceUrl?: string;
  netValueInCents: number;
  refunds: AsaasRefundEvidence[];
  status: string;
  transactionReceiptUrl?: string;
  valueInCents: number;
}

export interface AsaasInstallment {
  billingType: string;
  checkoutSession: string | null;
  id: string;
  installmentCount: number;
  netValueInCents: number;
  paymentValueInCents: number;
  refunds: AsaasRefundEvidence[];
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

export interface RefundAsaasInstallment {
  installmentId: string;
}

export interface AsaasGateway {
  cancelCheckout(checkoutId: string): Promise<AsaasCheckout>;
  createCheckout(input: CreateAsaasCheckout): Promise<AsaasCheckout>;
  createCustomer(input: CreateAsaasCustomer): Promise<AsaasCustomerReference>;
  createPayment(input: CreateAsaasPayment): Promise<CreatedAsaasPayment>;
  getAccountFees(): Promise<AsaasCreditCardFeeSchedule>;
  getCustomer(customerId: string): Promise<AsaasCustomer>;
  getInstallment(installmentId: string): Promise<AsaasInstallment>;
  getPayment(paymentId: string): Promise<AsaasPayment>;
  listCustomers(filters: ListAsaasCustomers): Promise<AsaasCustomerPage>;
  listFinancialTransactions(
    filters: ListAsaasFinancialTransactions
  ): Promise<AsaasFinancialTransactionPage>;
  listInstallmentPayments(installmentId: string): Promise<AsaasPaymentPage>;
  listPayments(filters: ListAsaasPayments): Promise<AsaasPaymentPage>;
  refundInstallment(input: RefundAsaasInstallment): Promise<AsaasInstallment>;
  refundPayment(input: RefundAsaasPayment): Promise<AsaasPayment>;
  simulatePayment(input: SimulateAsaasPayment): Promise<AsaasPaymentSimulation>;
}
