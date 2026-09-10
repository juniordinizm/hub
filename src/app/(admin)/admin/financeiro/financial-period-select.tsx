"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ADMIN_FINANCIAL_PERIODS,
  type AdminFinancialPeriod,
  getAdminFinancialPeriodLabel,
  isAdminFinancialPeriod,
} from "@/features/admin/financial-period";

export const getFinancialPeriodNavigationUrl = ({
  hash,
  pathname,
  period,
}: {
  hash: string;
  pathname: string;
  period: AdminFinancialPeriod;
}): string => {
  const nextSearchParams = new URLSearchParams();
  nextSearchParams.set("tab", "analysis");
  if (period === "all") {
    nextSearchParams.delete("period");
  } else {
    nextSearchParams.set("period", period);
  }

  const query = nextSearchParams.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
};

export function FinancialPeriodSelect({
  value,
}: {
  value: AdminFinancialPeriod;
}): React.JSX.Element {
  const router = useRouter();

  const changePeriod = (nextPeriod: string): void => {
    if (!isAdminFinancialPeriod(nextPeriod)) {
      return;
    }

    router.push(
      getFinancialPeriodNavigationUrl({
        hash: window.location.hash,
        pathname: window.location.pathname,
        period: nextPeriod,
      })
    );
  };

  return (
    <div className="grid gap-1.5 sm:justify-items-end">
      <label
        className="font-medium text-muted-foreground text-xs"
        htmlFor="financial-analysis-period"
      >
        Período
      </label>
      <Select onValueChange={changePeriod} value={value}>
        <SelectTrigger
          aria-label="Selecionar período da análise"
          className="w-full sm:w-52"
          id="financial-analysis-period"
        >
          <SelectValue placeholder="Selecionar período" />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectGroup>
            {ADMIN_FINANCIAL_PERIODS.map((period) => (
              <SelectItem key={period} value={period}>
                {getAdminFinancialPeriodLabel(period)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
