import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer>
      <div aria-busy="true" className="flex flex-col gap-8" role="status">
        <span className="sr-only">Carregando configurações globais…</span>
        <header className="border-b pb-6">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="mt-3 h-5 w-full max-w-[560px]" />
        </header>

        <section className="grid gap-4">
          <Skeleton className="h-6 w-56" />
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-full max-w-[520px]" />
              </div>
              <Skeleton className="h-5 w-28" />
            </div>
            <div className="mt-6 grid gap-6">
              <div className="grid gap-3">
                <Skeleton className="h-5 w-40" />
                <div className="grid gap-5 md:grid-cols-2">
                  {[
                    "issuer-legal-name",
                    "issuer-cnpj",
                    "issuer-display-name",
                  ].map((key) => (
                    <div className="grid gap-2" key={key}>
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  ))}
                </div>
              </div>
              <Skeleton className="h-px w-full" />
              <div className="grid gap-3">
                <Skeleton className="h-5 w-40" />
                <div className="grid gap-5 md:grid-cols-2">
                  {["signer-name", "signer-role"].map((key) => (
                    <div className="grid gap-2" key={key}>
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  ))}
                </div>
              </div>
              <Skeleton className="h-9 w-44" />
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
          <Skeleton className="h-[280px] w-full rounded-xl" />
        </section>
      </div>
    </PageContainer>
  );
}
