import { Skeleton } from "@/components/ui/skeleton";

export default function Loading(): React.JSX.Element {
  return (
    <div className="flex w-full min-w-0 max-w-full flex-col lg:grid lg:h-[calc(100svh-4rem)] lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 bg-muted/20 p-4 lg:p-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <div className="grid grid-cols-2 gap-1 rounded-lg border p-1 sm:grid-cols-4">
            {["video", "text", "attachments", "comments"].map((tab) => (
              <Skeleton className="h-9" key={`lesson-tab-${tab}`} />
            ))}
          </div>
          <Skeleton className="h-[420px] rounded-xl" />
        </div>
      </div>
      <aside className="flex min-w-0 flex-col gap-5 border-t bg-background p-4 lg:border-t-0 lg:border-l lg:p-5">
        <div className="space-y-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-7 w-full" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="mt-auto space-y-3 border-t pt-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </aside>
    </div>
  );
}
