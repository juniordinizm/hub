"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function RequestPasswordResetForm(): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/request-password-reset", {
      body: JSON.stringify({
        email: formData.get("email"),
        redirectTo: `${window.location.origin}/redefinir-senha`,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    setIsPending(false);
    setMessage(
      response.ok
        ? "Se o e-mail estiver cadastrado, o link sera enviado em instantes."
        : "Nao foi possivel solicitar a redefinicao agora."
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input
            autoComplete="email"
            id="email"
            name="email"
            required
            type="email"
          />
        </Field>
      </FieldGroup>
      {message ? (
        <Alert className="mt-5">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <Button className="mt-5 h-12 w-full" disabled={isPending} type="submit">
        {isPending ? "Enviando..." : "Enviar link"}
      </Button>
    </form>
  );
}
