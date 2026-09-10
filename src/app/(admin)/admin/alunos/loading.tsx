import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer>
      <div aria-busy="true" className="flex flex-col gap-6" role="status">
        <span className="sr-only">Carregando a lista de Alunos…</span>

        <header className="border-b pb-6">
          <div className="grid gap-3">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-5 w-full max-w-[420px]" />
          </div>
        </header>

        <section>
          <Skeleton className="mb-3 h-5 w-36" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-[126px] rounded-xl" />
            <Skeleton className="h-[126px] rounded-xl" />
            <Skeleton className="h-[126px] rounded-xl" />
            <Skeleton className="h-[126px] rounded-xl" />
          </div>
        </section>

        <section className="rounded-lg bg-card py-6 text-card-foreground shadow-sm ring-1 ring-border/50">
          <div className="grid gap-1.5 px-6 pb-4">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-4 w-full max-w-[460px]" />
          </div>
          <div className="px-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Skeleton className="h-9 w-full max-w-[420px]" />
              <Skeleton className="h-9 w-20" />
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <div className="min-w-[820px]">
                <div className="grid grid-cols-[220px_260px_minmax(0,1fr)_180px_64px] gap-3 border-b p-4">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-12" />
                </div>
                <div className="grid gap-4 p-4">
                  <div className="grid grid-cols-[220px_260px_minmax(0,1fr)_180px_64px] items-center gap-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="size-9 rounded-lg" />
                  </div>
                  <div className="grid grid-cols-[220px_260px_minmax(0,1fr)_180px_64px] items-center gap-3">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-52" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="size-9 rounded-lg" />
                  </div>
                  <div className="grid grid-cols-[220px_260px_minmax(0,1fr)_180px_64px] items-center gap-3">
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="size-9 rounded-lg" />
                  </div>
                  <div className="grid grid-cols-[220px_260px_minmax(0,1fr)_180px_64px] items-center gap-3">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="size-9 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
