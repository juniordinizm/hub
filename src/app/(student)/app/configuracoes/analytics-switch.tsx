"use client";

import { useTransition } from "react";
import { setLearningAnalyticsPreferenceAction } from "@/app/(student)/app/actions";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function AnalyticsSwitch({ enabled }: { enabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleCheckedChange(checked: boolean) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("enabled", checked ? "true" : "false");
      await setLearningAnalyticsPreferenceAction(formData);
    });
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 transition-opacity duration-200",
        isPending && "opacity-60"
      )}
    >
      <span aria-hidden="true" className="text-muted-foreground text-sm">
        {enabled ? "Ativado" : "Desativado"}
      </span>
      <Switch
        aria-label="Ativar análises opcionais"
        checked={enabled}
        disabled={isPending}
        onCheckedChange={handleCheckedChange}
      />
    </div>
  );
}
