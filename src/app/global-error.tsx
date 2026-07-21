"use client";

import { captureException } from "@sentry/nextjs";
import { useEffect, useRef, useState } from "react";
import { createCorrelationId } from "@/lib/observability";

export default function GlobalError({
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
    <html lang="pt-BR">
      <body className="bg-background text-foreground">
        <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-start justify-center gap-4 px-6">
          <h1 ref={headingRef} tabIndex={-1}>
            Ocorreu uma falha inesperada.
          </h1>
          <p>Tente novamente. Se persistir, contate a equipe responsável.</p>
          <p>Identificador de correlação: {correlationId}</p>
          {error.digest ? <p>Referência do servidor: {error.digest}</p> : null}
          <button
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
            onClick={unstable_retry}
            type="button"
          >
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
