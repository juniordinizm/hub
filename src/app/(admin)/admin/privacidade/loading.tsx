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

        <section className="flex flex-col gap-8">
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-col space-y-1.5 p-6">
              <Skeleton className="h-6 w-[200px]" />
            </div>
            <div className="space-y-4 p-6 pt-0">
              <div className="space-y-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-[180px]" />
                <Skeleton className="h-32 w-full" />
              </div>
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-col space-y-1.5 p-6">
              <Skeleton className="h-6 w-[180px]" />
              <Skeleton className="h-4 w-[400px]" />
            </div>
            <div className="p-6 pt-0">
              <Skeleton className="h-4 w-[250px]" />
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
