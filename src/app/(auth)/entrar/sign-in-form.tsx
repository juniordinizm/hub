"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { route } from "@/lib/routes";
import { isSuccessfulSignInPayload } from "./sign-in-result";

export function SignInForm(): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/sign-in/email", {
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      method: "POST",
    });

    setIsPending(false);

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!(response.ok && isSuccessfulSignInPayload(payload))) {
      setError("E-mail ou senha incorretos.");
      return;
    }

    const redirectResponse = await fetch("/api/auth/redirect", {
      credentials: "same-origin",
      headers: { "ngrok-skip-browser-warning": "true" },
    });

    if (!redirectResponse.ok) {
      setError("Não foi possível confirmar sua sessão. Tente novamente.");
      return;
    }

    const data = (await redirectResponse.json()) as { redirectTo?: string };

    window.location.assign(data.redirectTo ?? "/app");
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
            placeholder="aluno@exemplo.com"
            required
            type="email"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Senha</FieldLabel>
          <Input
            autoComplete="current-password"
            id="password"
            name="password"
            placeholder="Digite sua senha"
            required
            type="password"
          />
        </Field>
      </FieldGroup>
      {error ? (
        <Alert className="mt-5" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button className="mt-5 h-12 w-full" disabled={isPending} type="submit">
        {isPending ? "Entrando..." : "Entrar"}
      </Button>
      <Link
        className="mt-5 inline-flex text-muted-foreground text-sm hover:text-foreground"
        href={route("/recuperar-senha")}
      >
        Esqueci minha senha
      </Link>
    </form>
  );
}
