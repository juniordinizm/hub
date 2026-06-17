import { LockKeyIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type LessonStatus =
  | "completed"
  | "in_progress"
  | "next"
  | "locked"
  | "available";

export interface LessonCardProps {
  className?: string;
  durationText: string;
  moduleName: string;
  status: LessonStatus;
  thumbnailUrl?: string | null;
  title: string;
}

export function LessonCard({
  title,
  moduleName,
  durationText,
  status,
  thumbnailUrl,
  className,
}: LessonCardProps): React.JSX.Element {
  const isLocked = status === "locked";

  let statusBadge: React.JSX.Element | null = null;
  if (status === "in_progress") {
    statusBadge = (
      <Badge className="absolute bottom-3 left-3 border-transparent bg-teal-600 font-bold text-[10px] text-white uppercase tracking-wider hover:bg-teal-700">
        Em andamento
      </Badge>
    );
  } else if (status === "next") {
    statusBadge = (
      <Badge className="absolute bottom-3 left-3 border-transparent bg-zinc-700 font-bold text-[10px] text-white uppercase tracking-wider hover:bg-zinc-800">
        Próxima
      </Badge>
    );
  } else if (status === "locked") {
    statusBadge = (
      <Badge className="absolute bottom-3 left-3 border-transparent bg-red-900/80 font-bold text-[10px] text-red-200 uppercase tracking-wider hover:bg-red-900">
        Bloqueada
      </Badge>
    );
  } else if (status === "completed") {
    statusBadge = (
      <Badge className="absolute bottom-3 left-3 border-transparent bg-emerald-600 font-bold text-[10px] text-white uppercase tracking-wider hover:bg-emerald-700">
        Concluída
      </Badge>
    );
  }

  return (
    <div
      className={cn("group flex w-[280px] shrink-0 flex-col gap-3", className)}
    >
      <div
        className={cn(
          "relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-border/50 bg-muted transition-all",
          !isLocked &&
            "group-hover:border-primary group-hover:ring-2 group-hover:ring-primary/50",
          isLocked && "opacity-60 grayscale-[50%]"
        )}
      >
        {thumbnailUrl ? (
          <Image
            alt={title}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            fill
            sizes="280px"
            src={thumbnailUrl}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-chart-4/80 to-background" />
        )}

        <div className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/10" />

        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-full bg-white/90 text-background shadow-sm backdrop-blur-sm transition-transform",
              !isLocked && "group-hover:scale-110",
              isLocked && "bg-white/50"
            )}
          >
            {isLocked ? (
              <HugeiconsIcon icon={LockKeyIcon} size={20} strokeWidth={2.5} />
            ) : (
              <HugeiconsIcon
                className="ml-1"
                icon={PlayIcon}
                size={20}
                strokeWidth={2.5}
              />
            )}
          </div>
        </div>

        {statusBadge}
      </div>

      <div className="flex flex-col gap-1">
        <h4 className="line-clamp-2 font-semibold text-sm leading-tight transition-colors group-hover:text-primary">
          {title}
        </h4>
        <p className="text-muted-foreground text-xs">
          {moduleName} · {durationText}
        </p>
      </div>
    </div>
  );
}
