"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const CERTIFICATE_REFRESH_INTERVAL_MS = 10_000;

export function PendingCertificateRefresh({
  enabled,
  showManualRefresh = false,
}: {
  enabled: boolean;
  showManualRefresh?: boolean;
}): React.JSX.Element | null {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, CERTIFICATE_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [enabled, router]);

  if (!showManualRefresh) {
    return null;
  }

  return (
    <Button onClick={() => router.refresh()} size="sm" variant="outline">
      Atualizar status
    </Button>
  );
}
