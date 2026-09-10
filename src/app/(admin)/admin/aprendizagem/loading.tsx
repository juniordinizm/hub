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

        <section>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="grid gap-1.5 sm:w-56">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="grid gap-1.5 sm:w-44">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-9 w-full" />
              </div>
              <Skeleton className="size-10" />
            </div>
          </div>
        </section>

        <section>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {["lessons", "errors", "without-starts", "viewing"].map((key) => (
              <div className="rounded-lg border bg-card p-5" key={key}>
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="size-5 rounded-full" />
                </div>
                <Skeleton className="mt-5 h-8 w-20" />
                <Skeleton className="mt-2 h-3 w-full" />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border">
          <div className="space-y-4 p-5">
            {["row-1", "row-2", "row-3", "row-4", "row-5"].map((key) => (
              <Skeleton className="h-10 w-full" key={key} />
            ))}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
