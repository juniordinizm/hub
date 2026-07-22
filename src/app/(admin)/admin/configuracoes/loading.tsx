import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer>
      <div className="flex max-w-4xl flex-col gap-8">
        <header className="border-b pb-6">
          <div className="space-y-3">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-5 w-full max-w-100" />
          </div>
        </header>

        <section className="grid gap-4">
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-col space-y-1.5 p-6 pb-4">
              <Skeleton className="h-6 w-37.5" />
              <Skeleton className="h-4 w-25" />
            </div>
            <div className="p-6 pt-0">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:divide-x md:border-t md:pt-4">
                <div className="space-y-2 md:pl-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-12" />
                </div>
                <div className="space-y-2 md:pl-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-12" />
                </div>
                <div className="space-y-2 md:pl-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-12" />
                </div>
                <div className="space-y-2 md:pl-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-12" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-col space-y-1.5 p-6 pb-4">
              <Skeleton className="h-6 w-50" />
              <Skeleton className="h-4 w-87.5" />
            </div>
            <div className="space-y-4 p-6 pt-0">
              <div className="space-y-2">
                <Skeleton className="h-4 w-37.5" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-37.5" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="mt-4 h-10 w-full" />
            </div>
          </div>

          <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-col space-y-1.5 p-6 pb-4">
              <Skeleton className="h-6 w-62.5" />
              <Skeleton className="h-4 w-87.5" />
            </div>
            <div className="space-y-4 p-6 pt-0">
              <Skeleton className="h-50 w-full" />
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
