import { Clock01Icon, File01Icon, PlayIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { formatLessonDuration } from "@/features/videos/jmvstream";

export function LessonSidebarDuration({
  durationSeconds,
  textDurationSeconds,
  videoDurationSeconds,
}: {
  durationSeconds: number;
  textDurationSeconds: number;
  videoDurationSeconds: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <DurationSummaryItem
        icon={PlayIcon}
        label="Vídeo"
        value={formatLessonDuration(videoDurationSeconds)}
      />
      <DurationSummaryItem
        icon={File01Icon}
        label="Texto"
        value={formatLessonDuration(textDurationSeconds)}
      />
      <DurationSummaryItem
        icon={Clock01Icon}
        label="Total"
        value={formatLessonDuration(durationSeconds)}
      />
    </div>
  );
}

function DurationSummaryItem({
  icon,
  label,
  value,
}: {
  // biome-ignore lint/suspicious/noExplicitAny: using Hugeicons
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border bg-background p-2.5 shadow-sm transition-colors hover:bg-muted/30">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <HugeiconsIcon icon={icon} size={14} strokeWidth={2} />
        <p className="font-medium text-[10px] uppercase tracking-wider">
          {label}
        </p>
      </div>
      <p className="font-semibold text-foreground text-sm leading-tight">
        {value}
      </p>
    </div>
  );
}
