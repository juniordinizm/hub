"use client";

import { captureException } from "@sentry/nextjs";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { createCorrelationId } from "@/lib/observability";

export default function AdminDashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}): React.JSX.Element {
  const [correlationId] = useState(() => createCorrelationId(null));
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    captureException(error, { tags: { correlation_id: correlationId } });
  }, [correlationId, error]);

  return (
    <section className="mx-auto flex min-h-64 w-full max-w-xl flex-col items-start justify-center gap-4 px-6 py-12">
      <h1 className="type-page-title" ref={headingRef} tabIndex={-1}>
        Não foi possível carregar o painel
      </h1>
      <p className="type-body-sm text-muted-foreground">
        Tente novamente. Se o problema continuar, informe o código abaixo à
        equipe.
      </p>
      <p className="type-code text-muted-foreground">
        Identificador de correlação: {correlationId}
      </p>
      {error.digest ? (
        <p className="type-code text-muted-foreground">
          Referência do servidor: {error.digest}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button onClick={unstable_retry} type="button">
          Tentar novamente
        </Button>
      </div>
    </section>
  );
}
