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
              <Skeleton className="h-5 w-full max-w-100" />
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-30 rounded-xl" />
          <Skeleton className="h-30 rounded-xl" />
          <Skeleton className="h-30 rounded-xl" />
          <Skeleton className="h-30 rounded-xl" />
        </section>

        <div className="rounded-xl border bg-card text-card-foreground shadow-sm ring-1 ring-border/50">
          <div className="flex flex-col space-y-1.5 p-6 pb-4">
            <Skeleton className="h-6 w-50" />
            <Skeleton className="h-4 w-100" />
          </div>
          <div className="p-6 pt-0">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-9 w-75" />
                <Skeleton className="h-9 w-37.5" />
              </div>
              <div className="rounded-md border">
                <div className="border-b p-4">
                  <Skeleton className="h-5 w-full" />
                </div>
                <div className="space-y-4 p-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
