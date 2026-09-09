"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const FINANCIAL_TABS = [
  { label: "Visão geral", value: "overview" },
  { label: "Pedidos", value: "orders" },
  { label: "Análises", value: "analysis" },
] as const;

type FinancialTab = (typeof FINANCIAL_TABS)[number]["value"];

const isFinancialTab = (value: string | null): value is FinancialTab =>
  FINANCIAL_TABS.some((tab) => tab.value === value);

const getActiveTab = (value: string | null): FinancialTab =>
  isFinancialTab(value) ? value : "overview";

const TAB_QUERY_KEYS: Record<FinancialTab, readonly string[]> = {
  analysis: ["period"],
  orders: ["checkout", "page", "paymentMethod", "q", "status"],
  overview: ["reviewPage"],
};

export function FinancialTabs({
  analysis,
  orders,
  overview,
}: {
  analysis: ReactNode;
  orders: ReactNode;
  overview: ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = getActiveTab(searchParams.get("tab"));

  const changeTab = (value: string): void => {
    if (!isFinancialTab(value)) {
      return;
    }

    const nextSearchParams = new URLSearchParams();
    for (const key of TAB_QUERY_KEYS[value]) {
      const currentValue = searchParams.get(key);
      if (currentValue) {
        nextSearchParams.set(key, currentValue);
      }
    }
    if (value === "overview") {
      nextSearchParams.delete("tab");
    } else {
      nextSearchParams.set("tab", value);
    }

    const query = nextSearchParams.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    router.push(nextUrl);
  };

  return (
    <Tabs className="gap-6" onValueChange={changeTab} value={activeTab}>
      <div className="flex max-w-full items-center gap-1 overflow-x-auto border-b">
        <TabsList
          aria-label="Seções do financeiro"
          className="min-w-max flex-nowrap"
          variant="line"
        >
          {FINANCIAL_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent className="flex flex-col gap-8" value="overview">
        {overview}
      </TabsContent>
      <TabsContent className="flex flex-col gap-8" value="orders">
        {orders}
      </TabsContent>
      <TabsContent className="flex flex-col gap-8" value="analysis">
        {analysis}
      </TabsContent>
    </Tabs>
  );
}
