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

        <section className="max-w-2xl rounded-lg border bg-card p-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-4 h-8 w-[300px]" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-4/5" />

          <div className="mt-8 flex items-center gap-2">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-4 w-[250px]" />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Skeleton className="h-9 w-[150px] rounded-md" />
            <Skeleton className="h-9 w-[150px] rounded-md" />
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
