"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

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
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    setIsPending(false);

    if (!response.ok) {
      setError("E-mail ou senha incorretos.");
      return;
    }

    window.location.assign("/app");
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label
          className="font-semibold text-[0.7rem] text-teal-100/70 uppercase tracking-[0.14em]"
          htmlFor="email"
        >
          E-mail
        </label>
        <input
          autoComplete="email"
          className="h-12 w-full rounded-md border border-teal-200/10 bg-[#162b2d] px-4 text-teal-50 outline-none transition focus:border-teal-300/50 focus:ring-4 focus:ring-teal-400/10"
          id="email"
          name="email"
          placeholder="aluna@exemplo.com"
          required
          type="email"
        />
      </div>
      <div className="space-y-2">
        <label
          className="font-semibold text-[0.7rem] text-teal-100/70 uppercase tracking-[0.14em]"
          htmlFor="password"
        >
          Senha
        </label>
        <input
          autoComplete="current-password"
          className="h-12 w-full rounded-md border border-teal-200/10 bg-[#162b2d] px-4 text-teal-50 outline-none transition focus:border-teal-300/50 focus:ring-4 focus:ring-teal-400/10"
          id="password"
          name="password"
          placeholder="Digite sua senha"
          required
          type="password"
        />
      </div>
      {error ? <p className="text-orange-200 text-sm">{error}</p> : null}
      <Button
        className="h-12 w-full rounded-md bg-[#326c71] font-bold hover:bg-[#28595d]"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Entrando..." : "Entrar na area do aluno"}
      </Button>
    </form>
  );
}
