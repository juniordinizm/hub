"use client";

import { captureException } from "@sentry/nextjs";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { createCorrelationId } from "@/lib/observability";
import { route } from "@/lib/routes";

export default function StudentAreaError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}): React.JSX.Element {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [correlationId] = useState(() => createCorrelationId(null));

  useEffect(() => {
    headingRef.current?.focus();
    captureException(error, { tags: { correlation_id: correlationId } });
  }, [correlationId, error]);

  return (
    <section className="mx-auto flex min-h-64 w-full max-w-xl flex-col items-start justify-center gap-4 px-6 py-12">
      <h1 className="font-semibold text-2xl" ref={headingRef} tabIndex={-1}>
        Não foi possível carregar esta área
      </h1>
      <p className="text-muted-foreground">
        Tente novamente. Se continuar, informe o código abaixo ao suporte.
      </p>
      <p className="font-mono text-muted-foreground text-sm">
        Identificador de correlação: {correlationId}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={unstable_retry} type="button">
          Tentar novamente
        </Button>
        <Button asChild variant="outline">
          <Link href={route("/app")}>Voltar aos meus cursos</Link>
        </Button>
      </div>
    </section>
  );
}
