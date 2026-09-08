import { Skeleton } from "@/components/ui/skeleton";

export default function Loading(): React.JSX.Element {
  return (
    <div className="grid h-[calc(100svh-4rem)] grid-cols-1 overflow-hidden bg-background lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="custom-scrollbar min-w-0 overflow-y-auto">
        <Skeleton className="aspect-video w-full rounded-none" />
        <div className="mx-auto w-full max-w-5xl space-y-4 px-5 py-8 sm:px-8">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
      <div className="hidden h-full min-w-0 overflow-hidden border-l bg-background lg:block">
        <div className="space-y-4 border-b p-5">
          <Skeleton className="h-6 w-1/2" />
        </div>
        <div className="space-y-4 p-5">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}
