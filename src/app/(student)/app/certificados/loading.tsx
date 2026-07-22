import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <div className="flex flex-col gap-8">
        <header className="border-b pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 space-y-3">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-5 w-full max-w-[400px]" />
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 rounded-lg border bg-card p-4 md:max-w-xs">
          <div className="space-y-2 rounded-md bg-background/45 px-3 py-3">
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="space-y-2 rounded-md bg-background/45 px-3 py-3">
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
        </section>

        <section className="grid gap-4 pt-4">
          <Skeleton className="h-[220px] w-full rounded-xl" />
          <Skeleton className="h-[220px] w-full rounded-xl" />
        </section>
      </div>
    </PageContainer>
  );
}
