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

function LoadingHeader({ actionCount }: { actionCount: number }) {
  const actionKeys = actionCount === 1 ? ["main"] : ["catalog", "finance"];

  return (
    <header className="border-b pb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-full max-w-[400px]" />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {actionKeys.map((key) => (
            <Skeleton
              className="h-9 w-32"
              key={`dashboard-loading-action-${key}`}
            />
          ))}
        </div>
      </div>
    </header>
  );
}

function MetricLoadingGrid(): React.JSX.Element {
  const metricKeys = ["courses", "students", "access", "orders"];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metricKeys.map((key) => (
        <Skeleton
          className="h-[120px] rounded-xl"
          key={`dashboard-loading-metric-${key}`}
        />
      ))}
    </section>
  );
}

function AdminDashboardLoading(): React.JSX.Element {
  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <LoadingHeader actionCount={2} />
        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Skeleton className="h-[280px] rounded-xl" />
          <Skeleton className="h-[280px] rounded-xl" />
        </section>
        <MetricLoadingGrid />
        <section className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-[250px] rounded-xl" />
          <Skeleton className="h-[250px] rounded-xl" />
        </section>
      </div>
    </PageContainer>
  );
}

function SupportDashboardLoading(): React.JSX.Element {
  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <LoadingHeader actionCount={1} />
        <MetricLoadingGrid />
        <Skeleton className="h-[360px] rounded-xl" />
      </div>
    </PageContainer>
  );
}
