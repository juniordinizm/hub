import { Skeleton } from "@/components/ui/skeleton";

export default function Loading(): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex flex-1 flex-col">
        <Skeleton className="aspect-video w-full rounded-none" />
        <div className="max-w-4xl space-y-4 p-6">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
      <div className="hidden w-80 shrink-0 border-l bg-muted/10 lg:block">
        <div className="space-y-4 border-b p-4">
          <Skeleton className="h-6 w-1/2" />
        </div>
        <div className="space-y-4 p-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}
