import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <header className="border-b pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 space-y-3">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-5 w-full max-w-[400px]" />
            </div>
          </div>
        </header>

        <div className="space-y-8">
          <section className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b p-5">
              <Skeleton className="h-6 w-[200px]" />
              <Skeleton className="mt-2 h-4 w-[400px]" />
            </div>
            <div className="space-y-4 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b p-5">
              <Skeleton className="h-6 w-[250px]" />
              <Skeleton className="mt-2 h-4 w-[450px]" />
            </div>
            <div className="space-y-4 p-5">
              <Skeleton className="h-[120px] w-full rounded-lg" />
              <Skeleton className="h-[120px] w-full rounded-lg" />
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b p-5">
              <Skeleton className="h-6 w-[220px]" />
              <Skeleton className="mt-2 h-4 w-[350px]" />
            </div>
            <div className="space-y-4 p-5">
              <Skeleton className="h-[80px] w-full rounded-lg" />
              <Skeleton className="h-[80px] w-full rounded-lg" />
            </div>
          </section>
        </div>
      </div>
    </PageContainer>
  );
}
