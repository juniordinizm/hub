"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  getNewPasswordValidationError,
  PASSWORD_MIN_LENGTH,
} from "@/lib/password-policy";
import { route } from "@/lib/routes";

type ResetPasswordState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success" }
  | { canRequestNewLink: boolean; message: string; status: "error" };

const PASSWORD_TOO_LONG_MESSAGE =
  "A senha informada é muito longa. Tente uma senha menor.";

const INVALID_TOKEN_MESSAGE = "Link inválido ou expirado.";
const NETWORK_ERROR_MESSAGE =
  "Não foi possível atualizar a senha. Tente novamente.";

async function getResetErrorCode(response: Response): Promise<unknown> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "code" in body) {
      return body.code;
    }
  } catch {
    return null;
  }
  return null;
}

export function ResetPasswordForm({
  token,
}: Readonly<{ token: string }>): React.JSX.Element {
  const [state, setState] = useState<ResetPasswordState>({ status: "idle" });
  const submissionInFlight = useRef(false);
  const successAlertRef = useRef<HTMLDivElement>(null);
  const isSubmitting = state.status === "submitting";

  useEffect(() => {
    if (state.status === "success") {
      successAlertRef.current?.focus();
    }
  }, [state.status]);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    if (submissionInFlight.current) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");
    const passwordError = getNewPasswordValidationError({
      confirmation,
      password,
    });

    if (passwordError) {
      setState({
        canRequestNewLink: false,
        message: passwordError,
        status: "error",
      });
      return;
    }

    submissionInFlight.current = true;
    setState({ status: "submitting" });

    try {
      const response = await fetch("/api/auth/reset-password", {
        body: JSON.stringify({ newPassword: password, token }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const errorCode = await getResetErrorCode(response);

        if (errorCode === "INVALID_TOKEN") {
          setState({
            canRequestNewLink: true,
            message: INVALID_TOKEN_MESSAGE,
            status: "error",
          });
          return;
        }

        setState({
          canRequestNewLink: false,
          message:
            errorCode === "PASSWORD_TOO_LONG"
              ? PASSWORD_TOO_LONG_MESSAGE
              : NETWORK_ERROR_MESSAGE,
          status: "error",
        });
        return;
      }

      setState({ status: "success" });
    } catch {
      setState({
        canRequestNewLink: false,
        message: NETWORK_ERROR_MESSAGE,
        status: "error",
      });
    } finally {
      submissionInFlight.current = false;
    }
  };

  if (!token) {
    return (
      <Alert role="alert" variant="destructive">
        <AlertDescription>
          Link inválido ou expirado.{" "}
          <Link href={route("/recuperar-senha")}>
            Solicite uma nova recuperação de senha.
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  if (state.status === "success") {
    return (
      <div className="space-y-5">
        <Alert
          aria-live="polite"
          ref={successAlertRef}
          role="status"
          tabIndex={-1}
        >
          <AlertDescription>
            <p className="font-medium text-foreground">
              Senha definida com sucesso
            </p>
            <p className="mt-1">
              Agora você já pode entrar com sua nova senha.
            </p>
          </AlertDescription>
        </Alert>
        <Button asChild className="h-12 w-full">
          <Link href={route("/entrar")}>Entrar</Link>
        </Button>
      </div>
    );
  }

  return (
    <form aria-busy={isSubmitting} onSubmit={handleSubmit}>
      <fieldset className="contents" disabled={isSubmitting}>
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
        {state.status === "error" ? (
          <div className="mt-5 space-y-3">
            <Alert role="alert" variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
            {state.canRequestNewLink ? (
              <Link
                className="inline-flex text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
                href={route("/recuperar-senha")}
              >
                Solicitar nova recuperação
              </Link>
            ) : null}
          </div>
        ) : null}
        <Button
          className="mt-5 h-12 w-full"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Salvando..." : "Salvar senha"}
        </Button>
      </fieldset>
    </form>
  );
}
