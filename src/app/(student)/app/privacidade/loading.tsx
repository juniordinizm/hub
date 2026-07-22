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

        <section className="flex flex-col gap-6">
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
