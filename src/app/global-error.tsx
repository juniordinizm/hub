"use client";

import { captureException } from "@sentry/nextjs";
import { useEffect, useState } from "react";
import { createCorrelationId } from "@/lib/observability";

export default function GlobalError({
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
    <html lang="pt-BR">
      <body>
        <main>
          <h1>Ocorreu uma falha inesperada.</h1>
          <p>Tente novamente. Se persistir, contate a equipe responsável.</p>
          <p>Identificador de correlação: {correlationId}</p>
          {error.digest ? <p>Referência do servidor: {error.digest}</p> : null}
          <button onClick={unstable_retry} type="button">
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
