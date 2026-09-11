import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

const OPERATIONS_SECTION_SKELETON_KEYS = [
  "alerts",
  "jmvstream",
  "webhooks",
  "outbox",
  "signals",
] as const;

export default function Loading(): React.JSX.Element {
  return (
    <PageContainer>
      <div aria-busy="true" className="flex flex-col gap-8" role="status">
        <span className="sr-only">Carregando operações e recuperação…</span>
        <header className="border-b pb-6">
          <Skeleton className="h-9 w-80" />
          <Skeleton className="mt-3 h-5 w-full max-w-[560px]" />
        </header>
        {OPERATIONS_SECTION_SKELETON_KEYS.map((key) => (
          <Skeleton
            className="h-[360px] rounded-xl"
            key={`operations-section-${key}`}
          />
        ))}
      </div>
    </PageContainer>
  );
}
