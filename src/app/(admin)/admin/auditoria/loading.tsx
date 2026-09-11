import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

const AUDIT_FILTER_SKELETON_KEYS = [
  "search",
  "source",
  "target",
  "from",
  "to",
  "actions",
] as const;
const AUDIT_ROW_SKELETON_KEYS = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
] as const;

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer>
      <div aria-busy="true" className="flex flex-col gap-8" role="status">
        <span className="sr-only">Carregando a auditoria administrativa…</span>
        <header className="border-b pb-6">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="mt-3 h-5 w-full max-w-[520px]" />
        </header>
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b p-5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-2 h-4 w-full max-w-[460px]" />
          </div>
          <div className="grid gap-4 border-b p-4 sm:grid-cols-2 lg:grid-cols-6">
            {AUDIT_FILTER_SKELETON_KEYS.map((key) => (
              <Skeleton className="h-16" key={`audit-filter-${key}`} />
            ))}
          </div>
          <div className="space-y-4 p-4">
            {AUDIT_ROW_SKELETON_KEYS.map((key) => (
              <Skeleton className="h-12" key={`audit-row-${key}`} />
            ))}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
