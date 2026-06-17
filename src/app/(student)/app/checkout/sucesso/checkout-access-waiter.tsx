"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface AccessResponse {
  canAccess?: boolean;
  redirectTo?: string;
}

const POLL_INTERVAL_MS = 2500;
const MAX_ATTEMPTS = 30;

export function CheckoutAccessWaiter({
  courseId,
}: {
  courseId: string | null;
}): React.JSX.Element {
  const [isChecking, setIsChecking] = useState(false);
  const [statusText, setStatusText] = useState(
    courseId
      ? "Estamos confirmando seu acesso automaticamente."
      : "Volte para seus cursos para conferir o acesso."
  );
  const attemptsRef = useRef(0);
  const stoppedRef = useRef(false);

  const checkAccess = useCallback(async (): Promise<void> => {
    if (!(courseId && !stoppedRef.current)) {
      return;
    }

    setIsChecking(true);

    try {
      const response = await fetch(
        `/api/enrollments/access?courseId=${encodeURIComponent(courseId)}`,
        {
          cache: "no-store",
          credentials: "same-origin",
          headers: { "ngrok-skip-browser-warning": "true" },
        }
      );

      if (!response.ok) {
        setStatusText("Ainda estamos confirmando seu acesso.");
        return;
      }

      const data = (await response.json()) as AccessResponse;

      if (data.canAccess && data.redirectTo) {
        stoppedRef.current = true;
        setStatusText("Acesso liberado. Abrindo seu curso...");
        window.location.replace(data.redirectTo);
        return;
      }

      setStatusText("Ainda estamos confirmando seu acesso.");
    } finally {
      attemptsRef.current += 1;
      setIsChecking(false);
    }
  }, [courseId]);

  const scheduleCheckAccess = useCallback((): void => {
    checkAccess().catch(() => {
      setStatusText("Ainda estamos confirmando seu acesso.");
    });
  }, [checkAccess]);

  useEffect(() => {
    if (!courseId) {
      return;
    }

    scheduleCheckAccess();
    const interval = window.setInterval(() => {
      if (stoppedRef.current || attemptsRef.current >= MAX_ATTEMPTS) {
        window.clearInterval(interval);
        return;
      }

      scheduleCheckAccess();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [courseId, scheduleCheckAccess]);

  return (
    <div className="mt-5 rounded-lg border bg-muted/40 p-4">
      <p className="text-muted-foreground text-sm leading-6">{statusText}</p>
      {courseId ? (
        <Button
          className="mt-3"
          disabled={isChecking}
          onClick={scheduleCheckAccess}
          type="button"
          variant="outline"
        >
          {isChecking ? "Verificando..." : "Verificar agora"}
        </Button>
      ) : null}
    </div>
  );
}
