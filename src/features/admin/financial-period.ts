export const ADMIN_FINANCIAL_PERIODS = ["all", "7d", "30d", "90d"] as const;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type AdminFinancialPeriod = (typeof ADMIN_FINANCIAL_PERIODS)[number];

export const isAdminFinancialPeriod = (
  value: string
): value is AdminFinancialPeriod =>
  ADMIN_FINANCIAL_PERIODS.includes(value as AdminFinancialPeriod);

export const getAdminFinancialPeriodLabel = (
  period: AdminFinancialPeriod
): string => {
  switch (period) {
    case "7d":
      return "Últimos 7 dias";
    case "30d":
      return "Últimos 30 dias";
    case "90d":
      return "Últimos 90 dias";
    default:
      return "Todo o histórico";
  }
};

export const getAdminFinancialPeriodStart = (
  period: AdminFinancialPeriod,
  now = new Date()
): Date | null => {
  let days: number | null = null;
  if (period === "7d") {
    days = 7;
  } else if (period === "30d") {
    days = 30;
  } else if (period === "90d") {
    days = 90;
  }
  if (!days) {
    return null;
  }
  return new Date(now.getTime() - days * MILLISECONDS_PER_DAY);
};
