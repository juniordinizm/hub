"use client";

import { useTransition } from "react";
import { setLearningAnalyticsPreferenceAction } from "@/app/(student)/app/actions";
import { Switch } from "@/components/ui/switch";

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
    <div className="flex items-center gap-3">
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
