"use client";

import { useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading(): React.JSX.Element {
  const activeTab = useSearchParams().get("tab");

  return (
    <PageContainer>
      <div aria-busy="true" className="flex flex-col gap-8">
        <span className="sr-only" role="status">
          Carregando Financeiro…
        </span>
        <header className="flex flex-col gap-4 border-b pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-5 w-full max-w-[460px]" />
            </div>
          </div>
        </header>

        <div className="max-w-full overflow-x-auto border-b">
          <div className="flex min-w-max gap-1">
            {["overview", "orders", "analysis"].map((key) => (
              <Skeleton className="h-9 w-28 rounded-md" key={key} />
            ))}
          </div>
        </div>

        {getFinancialTabLoading(activeTab)}
      </div>
    </PageContainer>
  );
}

function OverviewLoading(): React.JSX.Element {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {["revenue", "ticket", "open", "orders"].map((key) => (
          <Skeleton className="h-[120px] rounded-xl" key={key} />
        ))}
      </section>
      <section>
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </section>
      <section className="grid gap-8 xl:grid-cols-2">
        <Skeleton className="h-[380px] w-full rounded-xl" />
        <Skeleton className="h-[380px] w-full rounded-xl" />
      </section>
    </>
  );
}

function OrdersLoading(): React.JSX.Element {
  return (
    <section>
      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full max-w-[420px]" />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Skeleton className="h-9 w-full max-w-xl" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border">
          <Skeleton className="h-10 w-full rounded-none" />
          {["one", "two", "three", "four", "five", "six"].map((key) => (
            <Skeleton className="mt-px h-14 w-full rounded-none" key={key} />
          ))}
        </div>
      </div>
    </section>
  );
}

const getFinancialTabLoading = (activeTab: string | null): React.ReactNode => {
  if (activeTab === "orders") {
    return <OrdersLoading />;
  }
  if (activeTab === "analysis") {
    return <AnalysisLoading />;
  }
  return <OverviewLoading />;
};

function AnalysisLoading(): React.JSX.Element {
  return (
    <section>
      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full max-w-[420px]" />
          </div>
          <div className="grid gap-1.5 sm:justify-items-end">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-52" />
          </div>
        </div>
        <div className="mt-6 grid gap-8">
          <section className="grid gap-3">
            <div className="grid gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full max-w-[420px]" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {["gross", "fees", "refunds", "net"].map((key) => (
                <Skeleton className="h-[120px] rounded-xl" key={key} />
              ))}
            </div>
          </section>
          <section className="grid gap-3 border-t pt-6">
            <div className="grid gap-2">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-4 w-full max-w-[420px]" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {["orders", "average", "open", "refund-rate"].map((key) => (
                <Skeleton className="h-[120px] rounded-xl" key={key} />
              ))}
            </div>
          </section>
        </div>
        <Skeleton className="mt-6 h-24 w-full rounded-xl" />
      </div>
    </section>
  );
}
