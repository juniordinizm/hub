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

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-[250px]" />
            <Skeleton className="h-9 w-[100px]" />
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
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
