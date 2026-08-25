"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  getNewPasswordValidationError,
  PASSWORD_MIN_LENGTH,
} from "@/lib/password-policy";

export function ResetPasswordForm({
  token,
}: Readonly<{ token: string }>): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");

    const passwordError = getNewPasswordValidationError({
      confirmation,
      password,
    });
    if (passwordError) {
      setMessage(passwordError);
      return;
    }

    setIsPending(true);

    const response = await fetch("/api/auth/reset-password", {
      body: JSON.stringify({ newPassword: password, token }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    setIsPending(false);
    setMessage(
      response.ok
        ? "Senha definida. Voce ja pode entrar."
        : "Link invalido ou expirado."
    );
  };

  if (!token) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Link invalido ou expirado. Solicite uma nova recuperacao de senha.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="password">Nova senha</FieldLabel>
          <Input
            autoComplete="new-password"
            id="password"
            minLength={PASSWORD_MIN_LENGTH}
            name="password"
            required
            type="password"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmation">Confirmar senha</FieldLabel>
          <Input
            autoComplete="new-password"
            id="confirmation"
            minLength={PASSWORD_MIN_LENGTH}
            name="confirmation"
            required
            type="password"
          />
        </Field>
      </FieldGroup>
      {message ? (
        <Alert className="mt-5">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <Button className="mt-5 h-12 w-full" disabled={isPending} type="submit">
        {isPending ? "Salvando..." : "Salvar senha"}
      </Button>
    </form>
  );
}
