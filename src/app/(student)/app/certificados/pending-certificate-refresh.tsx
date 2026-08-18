"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const CERTIFICATE_REFRESH_INTERVAL_MS = 10_000;

export function PendingCertificateRefresh({
  enabled,
}: {
  enabled: boolean;
}): null {
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

  return null;
}
