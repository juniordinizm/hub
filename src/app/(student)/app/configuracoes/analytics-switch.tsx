"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setLearningAnalyticsPreferenceAction } from "@/app/(student)/app/actions";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function AnalyticsSwitch({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [checked, setChecked] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  function handleCheckedChange(nextChecked: boolean): void {
    const previousChecked = checked;
    setChecked(nextChecked);
    setError(null);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("enabled", nextChecked ? "true" : "false");
        await setLearningAnalyticsPreferenceAction(formData);
        router.refresh();
      } catch {
        setChecked(previousChecked);
        setError("Não foi possível salvar essa preferência. Tente novamente.");
      }
    });
  }

  return (
    <div className="grid gap-2">
      <div
        className={cn(
          "flex items-center gap-3 transition-opacity duration-200",
          isPending && "opacity-60"
        )}
      >
        <span aria-hidden="true" className="text-muted-foreground text-sm">
          {checked ? "Ativado" : "Desativado"}
        </span>
        <Switch
          aria-describedby={error ? "analytics-preference-error" : undefined}
          aria-label="Ativar análises opcionais"
          checked={checked}
          disabled={isPending}
          onCheckedChange={handleCheckedChange}
        />
      </div>
      {error ? (
        <p
          aria-live="assertive"
          className="text-destructive text-xs"
          id="analytics-preference-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
