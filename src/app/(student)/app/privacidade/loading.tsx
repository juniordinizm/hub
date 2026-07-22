import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer>
      <div className="flex max-w-4xl flex-col gap-8">
        <header className="border-b pb-6">
          <div className="space-y-3">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-5 w-full max-w-[400px]" />
          </div>
        </header>

        <section className="space-y-4 rounded-lg border bg-card p-6">
          <div className="space-y-2">
            <Skeleton className="h-6 w-[300px]" />
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="pt-4">
            <Skeleton className="h-10 w-[200px]" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
