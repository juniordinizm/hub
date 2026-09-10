import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentSession } from "@/lib/session";

export default async function AdminAreaLoading(): Promise<React.JSX.Element> {
  const session = await getCurrentSession();

  return session?.role === "support" ? (
    <SupportDashboardLoading />
  ) : (
    <AdminDashboardLoading />
  );
}

function LoadingHeader() {
  return (
    <header className="border-b pb-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-full max-w-[420px]" />
      </div>
    </header>
  );
}

function MetricLoadingBand(): React.JSX.Element {
  const metricKeys = ["revenue", "students", "access", "expiring", "orders"];

  return (
    <section>
      <Skeleton className="mb-3 h-5 w-28" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metricKeys.map((key) => (
          <Skeleton
            className="h-[126px] rounded-xl"
            key={`dashboard-loading-metric-${key}`}
          />
        ))}
      </div>
    </section>
  );
}

function SupportMetricLoadingGrid(): React.JSX.Element {
  const metricKeys = ["orders", "revenue", "enrollments", "courses"];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metricKeys.map((key) => (
        <Skeleton
          className="h-[126px] rounded-xl"
          key={`support-loading-metric-${key}`}
        />
      ))}
    </section>
  );
}

function AdminDashboardLoading(): React.JSX.Element {
  return (
    <PageContainer>
      <div aria-busy="true" className="flex flex-col gap-6" role="status">
        <span className="sr-only">Carregando o painel administrativo…</span>
        <LoadingHeader />
        <MetricLoadingBand />
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div className="grid gap-2">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <Skeleton className="h-5 w-28" />
          </div>
          <div className="grid gap-4">
            <Skeleton className="h-[340px] rounded-xl" />
            <Skeleton className="h-[420px] rounded-xl" />
          </div>
        </section>
        <section>
          <div className="mb-3 grid gap-2">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Skeleton className="h-[460px] rounded-xl" />
            <Skeleton className="h-[400px] rounded-xl" />
          </div>
        </section>
        <section>
          <div className="mb-3 grid gap-2">
            <Skeleton className="h-5 w-52" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-[240px] rounded-xl" />
            <Skeleton className="h-[210px] rounded-xl" />
            <Skeleton className="h-[270px] rounded-xl" />
          </div>
        </section>
        <section>
          <div className="mb-3 grid gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <div className="grid gap-4">
            <Skeleton className="h-[360px] rounded-xl" />
            <Skeleton className="h-[420px] rounded-xl" />
          </div>
        </section>
      </div>
    </PageContainer>
  );
}

function SupportDashboardLoading(): React.JSX.Element {
  return (
    <PageContainer>
      <div aria-busy="true" className="flex flex-col gap-6" role="status">
        <span className="sr-only">Carregando o painel de suporte…</span>
        <LoadingHeader />
        <Skeleton className="h-[360px] rounded-xl" />
        <SupportMetricLoadingGrid />
      </div>
    </PageContainer>
  );
}
