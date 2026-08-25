"use client";

import Link from "next/link";
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
import { route } from "@/lib/routes";
import { isSuccessfulSignUpPayload } from "./sign-up-result";

export function SignUpForm(): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const passwordConfirmation = String(
      formData.get("passwordConfirmation") ?? ""
    );

    const passwordError = getNewPasswordValidationError({
      confirmation: passwordConfirmation,
      password,
    });
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setIsPending(true);

    try {
      const response = await fetch("/api/auth/sign-up/email", {
        body: JSON.stringify({
          email: formData.get("email"),
          name: formData.get("name"),
          password,
        }),
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        method: "POST",
      });
      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

      if (!(response.ok && isSuccessfulSignUpPayload(payload))) {
        setError(
          "Nao foi possivel criar a conta. Confira os dados e tente novamente."
        );
        return;
      }

      const redirectResponse = await fetch("/api/auth/redirect", {
        credentials: "same-origin",
        headers: { "ngrok-skip-browser-warning": "true" },
      });

      if (!redirectResponse.ok) {
        setError(
          "Sua conta foi criada, mas nao foi possivel iniciar a sessao."
        );
        return;
      }

      const data = (await redirectResponse.json()) as { redirectTo?: string };
      window.location.assign(data.redirectTo ?? "/app");
    } catch {
      setError("Nao foi possivel criar a conta. Tente novamente.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Nome completo</FieldLabel>
          <Input autoComplete="name" id="name" name="name" required />
        </Field>
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
            autoComplete="new-password"
            id="password"
            minLength={PASSWORD_MIN_LENGTH}
            name="password"
            required
            type="password"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="passwordConfirmation">
            Confirmar senha
          </FieldLabel>
          <Input
            autoComplete="new-password"
            id="passwordConfirmation"
            minLength={PASSWORD_MIN_LENGTH}
            name="passwordConfirmation"
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
        {isPending ? "Criando conta..." : "Criar conta"}
      </Button>
      <Link
        className="mt-5 inline-flex text-muted-foreground text-sm hover:text-foreground"
        href={route("/entrar")}
      >
        Ja tenho uma conta
      </Link>
    </form>
  );
}
