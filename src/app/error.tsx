"use client";

import { captureException } from "@sentry/nextjs";
import { useEffect, useState } from "react";
import { createCorrelationId } from "@/lib/observability";

export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}): React.JSX.Element {
  const [correlationId] = useState(() => createCorrelationId(null));

  useEffect(() => {
    captureException(error, { tags: { correlation_id: correlationId } });
  }, [correlationId, error]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-start justify-center gap-4 px-6">
      <h1 className="font-semibold text-2xl">
        Não foi possível carregar esta página.
      </h1>
      <p className="text-muted-foreground">
        Tente novamente. Se o problema continuar, informe o código de suporte
        abaixo à equipe.
      </p>
      <p className="font-mono text-muted-foreground text-sm">
        Identificador de correlação: {correlationId}
      </p>
      {error.digest ? (
        <p className="font-mono text-muted-foreground text-sm">
          Referência do servidor: {error.digest}
        </p>
      ) : null}
      <button
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        onClick={unstable_retry}
        type="button"
      >
        Tentar novamente
      </button>
    </main>
  );
}
