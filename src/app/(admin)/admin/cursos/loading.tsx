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
            <div className="flex shrink-0 items-center">
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
        </header>

        <section className="flex flex-wrap gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              className="flex aspect-[24/25] w-full max-w-[340px] shrink-0 flex-col overflow-hidden rounded-xl border bg-sidebar"
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton array
              key={i}
            >
              <Skeleton className="flex-1 rounded-none" />
              <div className="flex shrink-0 flex-col gap-5 p-5 sm:p-6">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </PageContainer>
  );
}
