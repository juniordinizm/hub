"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SupportRequestDialog } from "@/components/support-request-dialog";
import { Button } from "@/components/ui/button";

const VIDEO_PROCESSING_REFRESH_INTERVAL_MS = 15_000;

export function LessonVideoProcessing({
  courseTitle,
  state = "processing",
}: {
  courseTitle?: string;
  state?: "failed" | "processing";
}): React.JSX.Element {
  const router = useRouter();

  useEffect(() => {
    if (state === "failed") {
      return;
    }

    const interval = window.setInterval(
      () => router.refresh(),
      VIDEO_PROCESSING_REFRESH_INTERVAL_MS
    );

    return () => window.clearInterval(interval);
  }, [router, state]);

  if (state === "failed") {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-6 rounded-none bg-background px-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <p className="font-medium text-foreground text-xs uppercase tracking-widest">
            Vídeo indisponível
          </p>
          <p className="max-w-md font-light text-muted-foreground text-sm">
            Não foi possível preparar este vídeo. A equipe foi informada; use o
            suporte se precisar continuar o curso.
          </p>
        </div>
        <SupportRequestDialog
          {...(courseTitle ? { courseTitle } : {})}
          triggerLabel="Falar com suporte"
          triggerVariant="outline"
        />
      </div>
    );
  }

  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-6 rounded-none bg-background px-6 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 animate-pulse rounded-full bg-primary/10 motion-reduce:hidden" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary/5">
          <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-primary border-t-transparent motion-reduce:hidden" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="font-medium text-foreground text-xs uppercase tracking-widest">
          Processando vídeo
        </p>
        <p className="max-w-md font-light text-muted-foreground text-sm">
          Estamos preparando as qualidades desta aula. Isso pode levar alguns
          minutos; atualizaremos esta página automaticamente.
        </p>
        <Button
          onClick={() => router.refresh()}
          size="sm"
          type="button"
          variant="outline"
        >
          Verificar agora
        </Button>
      </div>
    </div>
  );
}
