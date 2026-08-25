"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { createTotpVerificationInput } from "@/lib/two-factor-policy";

type ChallengeMethod = "backup" | "totp";

const redirectAfterChallenge = async (): Promise<void> => {
  const response = await fetch("/api/auth/redirect", {
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error("session_not_available");
  }

  const payload = (await response.json()) as { redirectTo?: string };
  window.location.assign(payload.redirectTo ?? "/admin");
};

export function TwoFactorChallengeForm(): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [method, setMethod] = useState<ChallengeMethod>("totp");
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (error) {
      codeRef.current?.focus();
    }
  }, [error]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsPending(true);
    const code = String(new FormData(event.currentTarget).get("code") ?? "");

    try {
      const result =
        method === "totp"
          ? await authClient.twoFactor.verifyTotp(
              createTotpVerificationInput(code)
            )
          : await authClient.twoFactor.verifyBackupCode({
              code,
              disableSession: false,
            });

      if (result.error) {
        setError("Não foi possível validar o código. Tente novamente.");
        return;
      }

      await redirectAfterChallenge();
    } catch {
      setError("Não foi possível validar o código. Tente novamente.");
    } finally {
      setIsPending(false);
    }
  };

  const switchMethod = () => {
    setError(null);
    setMethod((current) => (current === "totp" ? "backup" : "totp"));
    requestAnimationFrame(() => codeRef.current?.focus());
  };

  return (
    <form onSubmit={handleSubmit}>
      <Field>
        <FieldLabel htmlFor="second-factor-code">
          {method === "totp"
            ? "Código do autenticador"
            : "Código de recuperação"}
        </FieldLabel>
        <Input
          autoComplete="one-time-code"
          id="second-factor-code"
          inputMode={method === "totp" ? "numeric" : "text"}
          maxLength={method === "totp" ? 6 : 64}
          minLength={method === "totp" ? 6 : 1}
          name="code"
          pattern={method === "totp" ? "[0-9]{6}" : undefined}
          ref={codeRef}
          required
        />
      </Field>
      {error ? (
        <Alert aria-live="assertive" className="mt-5" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button className="mt-5 h-12 w-full" disabled={isPending} type="submit">
        {isPending ? "Validando..." : "Confirmar"}
      </Button>
      <Button
        className="mt-2 w-full"
        disabled={isPending}
        onClick={switchMethod}
        type="button"
        variant="ghost"
      >
        {method === "totp"
          ? "Usar código de recuperação"
          : "Usar aplicativo autenticador"}
      </Button>
      <p aria-live="polite" className="sr-only" role="status">
        {method === "totp"
          ? "Entrada por aplicativo autenticador selecionada."
          : "Entrada por código de recuperação selecionada."}
      </p>
    </form>
  );
}
