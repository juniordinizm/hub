import {
  Clock01Icon,
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

export type LessonLockReason = "time" | "sequence";

export interface LessonCardProps {
  className?: string;
  durationText: string;
  hasVideo?: boolean;
  lockReason?: LessonLockReason;
  status: LessonStatus;
  thumbnailUnoptimized?: boolean;
  thumbnailUrl?: string | null;
  title: string;
  watchedPercent?: number;
}

export function LessonCard({
  title,
  durationText,
  status,
  hasVideo = true,
  lockReason,
  thumbnailUrl,
  thumbnailUnoptimized = false,
  className,
  watchedPercent,
}: LessonCardProps): React.JSX.Element {
  const isLocked = status === "locked";
  const CenterIcon = getCenterIcon({ hasVideo, isLocked });
  const centerIconClassName =
    !isLocked && hasVideo ? "translate-x-[2px]" : undefined;

  const statusBadge = getStatusBadge({ lockReason, status });

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
            className={cn(
              "object-cover transition-transform duration-500",
              !isLocked && "group-hover:scale-105"
            )}
            fill
            sizes="280px"
            src={thumbnailUrl}
            unoptimized={thumbnailUnoptimized}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-chart-4/80 to-background" />
        )}

        <div
          className={cn(
            "absolute inset-0 bg-black/20",
            !isLocked && "transition-colors group-hover:bg-black/10"
          )}
        />

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
        <h4
          className={cn(
            "line-clamp-2 font-semibold text-sm leading-tight",
            !isLocked && "transition-colors group-hover:text-accent"
          )}
        >
          {title}
        </h4>
        <p className="text-muted-foreground text-xs">{durationText}</p>
      </div>
    </div>
  );
}

function getStatusBadge({
  lockReason,
  status,
}: {
  lockReason: LessonLockReason | undefined;
  status: LessonStatus;
}): React.JSX.Element | null {
  const className =
    "absolute top-3 left-3 font-bold text-[10px] uppercase tracking-wider shadow-sm";

  if (status === "in_progress") {
    return (
      <Badge className={className} variant="default">
        Em andamento
      </Badge>
    );
  }
  if (status === "next") {
    return (
      <Badge className={className} variant="secondary">
        Próxima
      </Badge>
    );
  }
  if (status === "completed") {
    return (
      <Badge className={className} variant="secondary">
        Concluída
      </Badge>
    );
  }
  if (status !== "locked") {
    return null;
  }
  if (lockReason === "time") {
    return (
      <Badge
        className={cn(
          className,
          "gap-1 bg-amber-600 text-white hover:bg-amber-600 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-400"
        )}
        variant="default"
      >
        <HugeiconsIcon
          data-icon="inline-start"
          icon={Clock01Icon}
          size={13}
          strokeWidth={2}
        />
        Em breve
      </Badge>
    );
  }
  if (lockReason === "sequence") {
    return (
      <Badge
        className={cn(
          className,
          "gap-1 bg-sky-700 text-white hover:bg-sky-700 dark:bg-sky-300 dark:text-sky-950 dark:hover:bg-sky-300"
        )}
        variant="default"
      >
        <HugeiconsIcon
          data-icon="inline-start"
          icon={SquareLock02Icon}
          size={13}
          strokeWidth={2}
        />
        Continue a sequência
      </Badge>
    );
  }
  return (
    <Badge
      className={cn(
        className,
        "bg-secondary text-secondary-foreground hover:bg-secondary dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary"
      )}
      variant="secondary"
    >
      Bloqueada
    </Badge>
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
