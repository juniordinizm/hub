"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getPasswordResetRedirectUrl } from "@/lib/auth-policy";
import { route } from "@/lib/routes";

type RequestPasswordResetState = "idle" | "submitting" | "accepted" | "error";

const REQUEST_ERROR_MESSAGE =
  "Não foi possível processar a solicitação. Tente novamente.";
const REQUEST_ACCEPTED_MESSAGE =
  "Se o e-mail estiver cadastrado, enviaremos um link em instantes. Verifique sua caixa de entrada e a pasta de spam.";

export function RequestPasswordResetForm(): React.JSX.Element {
  const [state, setState] = useState<RequestPasswordResetState>("idle");
  const submissionInFlight = useRef(false);
  const isSubmitting = state === "submitting";

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    if (submissionInFlight.current) {
      return;
    }

    submissionInFlight.current = true;
    setState("submitting");
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/request-password-reset", {
        body: JSON.stringify({
          email: formData.get("email"),
          redirectTo: getPasswordResetRedirectUrl({
            appUrl: process.env.NEXT_PUBLIC_APP_URL,
            fallbackOrigin: window.location.origin,
          }),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setState(response.ok ? "accepted" : "error");
    } catch {
      setState("error");
    } finally {
      submissionInFlight.current = false;
    }
  };

  if (state === "accepted") {
    return (
      <div className="space-y-5">
        <Alert aria-live="polite" className="mt-5" role="status">
          <AlertDescription>
            <p className="font-medium text-foreground">Confira seu e-mail</p>
            <p className="mt-1">{REQUEST_ACCEPTED_MESSAGE}</p>
          </AlertDescription>
        </Alert>
        <div className="flex flex-col gap-3">
          <Button asChild className="h-12 w-full">
            <Link href={route("/entrar")}>Voltar para login</Link>
          </Button>
          <Button
            onClick={() => setState("idle")}
            type="button"
            variant="outline"
          >
            Tentar com outro e-mail
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form aria-busy={isSubmitting} onSubmit={handleSubmit}>
      <fieldset className="contents" disabled={isSubmitting}>
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
        {state === "error" ? (
          <Alert className="mt-5" role="alert" variant="destructive">
            <AlertDescription>{REQUEST_ERROR_MESSAGE}</AlertDescription>
          </Alert>
        ) : null}
        <Button
          className="mt-5 h-12 w-full"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Enviando..." : "Enviar link"}
        </Button>
      </fieldset>
    </form>
  );
}
