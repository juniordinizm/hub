import {
  File01Icon,
  PlayIcon,
  SquareLock02Icon,
} from "@hugeicons/core-free-icons";
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
  hasVideo?: boolean;
  status: LessonStatus;
  thumbnailUrl?: string | null;
  title: string;
  watchedPercent?: number;
}

export function LessonCard({
  title,
  durationText,
  status,
  hasVideo = true,
  thumbnailUrl,
  className,
  watchedPercent,
}: LessonCardProps): React.JSX.Element {
  const isLocked = status === "locked";
  const CenterIcon = getCenterIcon({ hasVideo, isLocked });
  const centerIconClassName =
    !isLocked && hasVideo ? "translate-x-[2px]" : undefined;

  let statusBadge: React.JSX.Element | null = null;
  if (status === "in_progress") {
    statusBadge = (
      <Badge
        className="absolute top-3 left-3 font-bold text-[10px] uppercase tracking-wider shadow-sm"
        variant="default"
      >
        Em andamento
      </Badge>
    );
  } else if (status === "next") {
    statusBadge = (
      <Badge
        className="absolute top-3 left-3 font-bold text-[10px] uppercase tracking-wider shadow-sm"
        variant="secondary"
      >
        Próxima
      </Badge>
    );
  } else if (status === "locked") {
    statusBadge = (
      <Badge
        className="absolute top-3 left-3 font-bold text-[10px] uppercase tracking-wider shadow-sm"
        variant="destructive"
      >
        Bloqueada
      </Badge>
    );
  } else if (status === "completed") {
    statusBadge = (
      <Badge
        className="absolute top-3 left-3 font-bold text-[10px] uppercase tracking-wider shadow-sm"
        variant="secondary"
      >
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
          "relative isolate aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted transition-[opacity,filter]",
          "after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] dark:after:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]",
          !isLocked &&
            "after:transition-shadow after:duration-300 group-hover:after:shadow-[inset_0_0_0_2px_hsl(var(--primary))]",
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

        {status !== "completed" && watchedPercent && watchedPercent > 0 ? (
          <div className="absolute bottom-0 left-0 z-10 h-1.5 w-full bg-background/40 backdrop-blur-sm">
            <div
              className="h-full bg-primary transition-[width] duration-500 ease-in-out"
              style={{
                width: `${Math.min(100, Math.max(0, watchedPercent))}%`,
              }}
            />
          </div>
        ) : null}

        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-full bg-white/90 text-background shadow-sm backdrop-blur-sm transition-transform duration-300",
              !isLocked && "group-hover:scale-110",
              isLocked && "bg-white/50"
            )}
          >
            <HugeiconsIcon
              className={centerIconClassName}
              icon={CenterIcon}
              size={20}
              strokeWidth={2.5}
            />
          </div>
        </div>

        {statusBadge && <div className="z-10">{statusBadge}</div>}
      </div>

      <div className="flex flex-col gap-1">
        <h4 className="line-clamp-2 font-semibold text-sm leading-tight transition-colors group-hover:text-accent">
          {title}
        </h4>
        <p className="text-muted-foreground text-xs">{durationText}</p>
      </div>
    </div>
  );
}

const getCenterIcon = ({
  hasVideo,
  isLocked,
}: {
  hasVideo: boolean;
  isLocked: boolean;
}) => {
  if (isLocked) {
    return SquareLock02Icon;
  }

  return hasVideo ? PlayIcon : File01Icon;
};
