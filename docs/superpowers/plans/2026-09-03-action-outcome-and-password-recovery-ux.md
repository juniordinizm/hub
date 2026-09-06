
# Estados de conclusão de ações e recuperação de senha Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Aplicar estados terminais e bloqueio contra submissões duplicadas aos dois formulários públicos de recuperação de senha, preservando anti-enumeração e os contratos existentes do Better Auth.

**Architecture:** Manter os Route Handlers e o fetch manual atuais. Cada formulário terá uma máquina de estados local e uma referência de submissão em andamento; sucesso renderiza uma confirmação sem o formulário, enquanto falhas mantêm uma nova tentativa acionável. O padrão será documentado para uma auditoria posterior dos demais fluxos, sem criar uma abstração global ou migration nesta entrega.

**Tech Stack:** Next.js 16 App Router, React 19.2.7, TypeScript, Better Auth, Vitest + JSDOM, Playwright, Bun e Ultracite.

---

## Arquivos e responsabilidades

- Modificar src/app/(auth)/recuperar-senha/request-password-reset-form.tsx: estado de solicitação, confirmação genérica, retry explícito e tratamento de falha.
- Criar src/app/(auth)/recuperar-senha/request-password-reset-form.test.tsx: contrato de submissão única, confirmação e retry deliberado.
- Modificar src/app/(auth)/redefinir-senha/reset-password-form.tsx: estado de redefinição, confirmação terminal, recuperação de token inválido e tratamento de rede.
- Criar src/app/(auth)/redefinir-senha/reset-password-form.test.tsx: contrato de validação, submissão única, sucesso terminal e falhas.
- Modificar tests/e2e/critical-journeys.spec.ts: adaptar a prova de anti-enumeração ao novo estado de confirmação e à retomada explícita.
- Modificar docs/domain/identity-and-authorization.md: registrar o novo comportamento visível sem alterar a regra de segurança.
- Modificar docs/README.md: indexar este plano junto da especificação aprovada.

O plano não modifica src/lib/auth.ts, src/lib/auth-password-reset.ts, o Route Handler catch-all, schema, migrations, variáveis de ambiente ou os demais formulários.

## Regras de execução

- Escrever o teste que falha antes da implementação de cada formulário.
- Preservar o texto genérico para Conta existente, Conta inexistente e falha de entrega.
- Não usar useFormStatus ou useActionState nestes componentes: eles continuam usando onSubmit + fetch, sem uma função action do React.
- Não adicionar cooldown, novo limite numérico, idempotência persistente ou migração.
- Não executar git commit ou git push; o projeto exige autorização explícita para isso.

### Task 1: Fixar o contrato do formulário de solicitação de recuperação

**Files:**

- Create: src/app/(auth)/recuperar-senha/request-password-reset-form.test.tsx
- Test against: src/app/(auth)/recuperar-senha/request-password-reset-form.tsx

- [ ] Step 1: Criar o teste JSDOM para confirmação, retry e submissão única

Adicionar o arquivo com o seguinte conteúdo. O mock de next/link mantém o teste isolado do runtime de navegação do Next.js; o mock da política fixa a URL sem tocar em ambiente real.

~~~tsx
/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  fetch: vi.fn(),
  getPasswordResetRedirectUrl: vi.fn(),
}));

vi.mock("@/lib/auth-policy", () => ({
  getPasswordResetRedirectUrl: dependencies.getPasswordResetRedirectUrl,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import { RequestPasswordResetForm } from "./request-password-reset-form";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const getForm = (container: HTMLDivElement): HTMLFormElement => {
  const form = container.querySelector("form");
  if (!form) {
    throw new Error("Expected the request form to be rendered.");
  }
  return form;
};

const getButton = (
  container: HTMLDivElement,
  label: string
): HTMLButtonElement => {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  if (!button) {
    throw new Error("Expected button " + label + " to be rendered.");
  }
  return button;
};

describe("RequestPasswordResetForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    dependencies.fetch.mockResolvedValue(
      new Response(null, { status: 200 })
    );
    dependencies.getPasswordResetRedirectUrl.mockReturnValue(
      "https://hub.example.test/redefinir-senha"
    );
    vi.stubGlobal("fetch", dependencies.fetch);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("replaces the accepted form with confirmation and requires explicit retry", async () => {
    act(() => root.render(<RequestPasswordResetForm />));

    const email = container.querySelector<HTMLInputElement>("#email");
    if (!email) {
      throw new Error("Expected the email input to be rendered.");
    }
    email.value = "student@example.test";

    await act(async () => {
      getForm(container).dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
      await Promise.resolve();
    });

    expect(dependencies.fetch).toHaveBeenCalledOnce();
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Se o e-mail estiver cadastrado"
    );

    await act(async () =>
      getButton(container, "Tentar com outro e-mail").click()
    );

    expect(container.querySelector("form")).not.toBeNull();
    expect(dependencies.fetch).toHaveBeenCalledOnce();
  });

  it("does not issue a second request while the first request is pending", async () => {
    let resolveResponse: (response: Response) => void = () => undefined;
    dependencies.fetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      })
    );

    act(() => root.render(<RequestPasswordResetForm />));
    const email = container.querySelector<HTMLInputElement>("#email");
    if (!email) {
      throw new Error("Expected the email input to be rendered.");
    }
    email.value = "student@example.test";

    act(() => {
      const form = getForm(container);
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
    });

    expect(dependencies.fetch).toHaveBeenCalledOnce();

    await act(async () => {
      resolveResponse(new Response(null, { status: 200 }));
      await Promise.resolve();
    });
  });

  it("keeps the form actionable after an HTTP failure", async () => {
    dependencies.fetch.mockResolvedValue(new Response(null, { status: 503 }));
    act(() => root.render(<RequestPasswordResetForm />));

    await act(async () => {
      getForm(container).dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
      await Promise.resolve();
    });

    expect(container.querySelector("form")).not.toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Não foi possível processar a solicitação"
    );
    expect(getButton(container, "Enviar link").disabled).toBe(false);
  });

  it("keeps the form actionable after a network failure", async () => {
    dependencies.fetch.mockRejectedValue(new TypeError("offline"));
    act(() => root.render(<RequestPasswordResetForm />));

    await act(async () => {
      getForm(container).dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
      await Promise.resolve();
    });

    expect(container.querySelector("form")).not.toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Não foi possível processar a solicitação"
    );
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
~~~

- [ ] Step 2: Executar o teste para confirmar a falha atual

Run:

~~~powershell
bun run test -- "src/app/(auth)/recuperar-senha/request-password-reset-form.test.tsx"
~~~

Expected: FAIL porque o formulário atual continua renderizado após 200, não possui retry explícito, e converte falha de rede em confirmação de sucesso.

### Task 2: Implementar o estado terminal da solicitação de recuperação

**Files:**

- Modify: src/app/(auth)/recuperar-senha/request-password-reset-form.tsx
- Test: src/app/(auth)/recuperar-senha/request-password-reset-form.test.tsx

- [ ] Step 1: Substituir a implementação pelo estado discriminado e pelo resultado terminal

Usar este conteúdo completo. O useRef cobre dois eventos síncronos antes de uma nova renderização; response.ok distingue aceitação HTTP de falhas; o texto permanece genérico e não confirma existência de Conta nem entrega pelo Resend.

~~~tsx
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

type RequestPasswordResetState =
  | "idle"
  | "submitting"
  | "accepted"
  | "error";

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
~~~

- [ ] Step 2: Executar os testes focais

Run:

~~~powershell
bun run test -- "src/app/(auth)/recuperar-senha/request-password-reset-form.test.tsx"
~~~

Expected: PASS; quatro testes confirmam estado terminal, retry explícito, bloqueio concorrente e tratamento de HTTP/rede.

- [ ] Step 3: Conferir o diff da primeira implementação

Run:

~~~powershell
git diff --check -- "src/app/(auth)/recuperar-senha/request-password-reset-form.tsx" "src/app/(auth)/recuperar-senha/request-password-reset-form.test.tsx"
~~~

Expected: nenhuma saída e código de saída 0. Não criar commit.

### Task 3: Fixar o contrato do formulário de nova senha

**Files:**

- Create: src/app/(auth)/redefinir-senha/reset-password-form.test.tsx
- Test against: src/app/(auth)/redefinir-senha/reset-password-form.tsx

- [ ] Step 1: Criar o teste JSDOM para sucesso terminal, token inválido, rede e validação local

Adicionar o arquivo com este conteúdo:

~~~tsx
/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import { ResetPasswordForm } from "./reset-password-form";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const getForm = (container: HTMLDivElement): HTMLFormElement => {
  const form = container.querySelector("form");
  if (!form) {
    throw new Error("Expected the reset form to be rendered.");
  }
  return form;
};

const getButton = (
  container: HTMLDivElement,
  label: string
): HTMLButtonElement => {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  if (!button) {
    throw new Error("Expected button " + label + " to be rendered.");
  }
  return button;
};

const fillValidPasswords = (container: HTMLDivElement): void => {
  const password = container.querySelector<HTMLInputElement>("#password");
  const confirmation =
    container.querySelector<HTMLInputElement>("#confirmation");
  if (!(password && confirmation)) {
    throw new Error("Expected both password inputs to be rendered.");
  }
  password.value = "New-password-123!";
  confirmation.value = "New-password-123!";
};

describe("ResetPasswordForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    dependencies.fetch.mockResolvedValue(
      new Response(null, { status: 200 })
    );
    vi.stubGlobal("fetch", dependencies.fetch);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("removes the form after a successful reset and links to login", async () => {
    act(() => root.render(<ResetPasswordForm token="valid-token" />));
    fillValidPasswords(container);

    await act(async () => {
      getForm(container).dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
      await Promise.resolve();
    });

    expect(dependencies.fetch).toHaveBeenCalledOnce();
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Senha definida com sucesso"
    );
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/entrar");
  });

  it("does not issue a second reset while the first request is pending", async () => {
    let resolveResponse: (response: Response) => void = () => undefined;
    dependencies.fetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      })
    );

    act(() => root.render(<ResetPasswordForm token="valid-token" />));
    fillValidPasswords(container);

    act(() => {
      const form = getForm(container);
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
    });

    expect(dependencies.fetch).toHaveBeenCalledOnce();

    await act(async () => {
      resolveResponse(new Response(null, { status: 200 }));
      await Promise.resolve();
    });
  });

  it("keeps the form and offers a new recovery link for an invalid token", async () => {
    dependencies.fetch.mockResolvedValue(new Response(null, { status: 400 }));
    act(() => root.render(<ResetPasswordForm token="expired-token" />));
    fillValidPasswords(container);

    await act(async () => {
      getForm(container).dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
      await Promise.resolve();
    });

    expect(container.querySelector("form")).not.toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Link inválido ou expirado"
    );
    expect(container.querySelector('a[href="/recuperar-senha"]')).not.toBeNull();
    expect(getButton(container, "Salvar senha").disabled).toBe(false);
  });

  it("re-enables the form after a network failure instead of staying pending", async () => {
    dependencies.fetch.mockRejectedValue(new TypeError("offline"));
    act(() => root.render(<ResetPasswordForm token="valid-token" />));
    fillValidPasswords(container);

    await act(async () => {
      getForm(container).dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
      await Promise.resolve();
    });

    expect(container.querySelector("form")).not.toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Não foi possível atualizar a senha"
    );
    expect(getButton(container, "Salvar senha").disabled).toBe(false);
  });

  it("rejects mismatched passwords before making a request", async () => {
    act(() => root.render(<ResetPasswordForm token="valid-token" />));
    const password = container.querySelector<HTMLInputElement>("#password");
    const confirmation =
      container.querySelector<HTMLInputElement>("#confirmation");
    if (!(password && confirmation)) {
      throw new Error("Expected both password inputs to be rendered.");
    }
    password.value = "New-password-123!";
    confirmation.value = "Different-password-123!";

    await act(async () => {
      getForm(container).dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
      await Promise.resolve();
    });

    expect(dependencies.fetch).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "As senhas precisam ser iguais"
    );
  });

  it("keeps the missing-token guard without rendering a form", () => {
    act(() => root.render(<ResetPasswordForm token="" />));

    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Link inválido ou expirado"
    );
    expect(dependencies.fetch).not.toHaveBeenCalled();
  });
});
~~~

- [ ] Step 2: Executar o teste para confirmar a falha atual

Run:

~~~powershell
bun run test -- "src/app/(auth)/redefinir-senha/reset-password-form.test.tsx"
~~~

Expected: FAIL porque o sucesso atual deixa o formulário renderizado, uma falha de rede rejeita o handler sem restaurar o estado, e não existe link direto para iniciar nova recuperação após token inválido.

### Task 4: Implementar a redefinição terminal e os erros recuperáveis

**Files:**

- Modify: src/app/(auth)/redefinir-senha/reset-password-form.tsx
- Test: src/app/(auth)/redefinir-senha/reset-password-form.test.tsx

- [ ] Step 1: Substituir a implementação pelo estado discriminado

Usar este conteúdo completo. O estado de erro carrega a mensagem e informa se o link para /recuperar-senha é pertinente; falha de rede não é confundida com token inválido.

O trecho abaixo é a linha de base; a implementação final usa o mapeamento de códigos JSON descrito na seção **Revisão do plano**.

~~~tsx
"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useRef, useState } from "react";
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

const INVALID_TOKEN_MESSAGE = "Link inválido ou expirado.";
const NETWORK_ERROR_MESSAGE =
  "Não foi possível atualizar a senha. Tente novamente.";

export function ResetPasswordForm({
  token,
}: Readonly<{ token: string }>): React.JSX.Element {
  const [state, setState] = useState<ResetPasswordState>({ status: "idle" });
  const submissionInFlight = useRef(false);
  const isSubmitting = state.status === "submitting";

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
          message: errorCode === "PASSWORD_TOO_LONG"
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
        <Alert aria-live="polite" role="status">
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
~~~

- [ ] Step 2: Executar os testes focais da redefinição

Run:

~~~powershell
bun run test -- "src/app/(auth)/redefinir-senha/reset-password-form.test.tsx"
~~~

Expected: PASS; seis testes confirmam sucesso terminal, uma única submissão, token inválido, rede, validação local e token ausente.

- [ ] Step 3: Conferir o diff da segunda implementação

Run:

~~~powershell
git diff --check -- "src/app/(auth)/redefinir-senha/reset-password-form.tsx" "src/app/(auth)/redefinir-senha/reset-password-form.test.tsx"
~~~

Expected: nenhuma saída e código de saída 0. Não criar commit.

### Task 5: Atualizar a prova E2E e a documentação canônica

**Files:**

- Modify: tests/e2e/critical-journeys.spec.ts
- Modify: docs/domain/identity-and-authorization.md
- Modify: docs/README.md

- [ ] Step 1: Adaptar o teste E2E de anti-enumeração

Substituir o corpo do teste login and password recovery do not enumerate accounts @mobile por:

~~~ts
test("login and password recovery do not enumerate accounts @mobile", async ({
  page,
}) => {
  const fixture = await readFixture();
  await signIn(page, fixture.studentWithGrant, APP_URL_PATTERN);

  await page.goto("/recuperar-senha");
  await page.getByLabel("E-mail").fill(fixture.studentWithGrant.email);
  await page.getByRole("button", { name: "Enviar link" }).click();

  const resetConfirmation = page.getByRole("status");
  await expect(resetConfirmation).toContainText(
    "Se o e-mail estiver cadastrado"
  );
  const knownMessage = await resetConfirmation.textContent();
  await expect(
    page.getByRole("button", { name: "Enviar link" })
  ).toHaveCount(0);
  await expect(page.locator("form")).toHaveCount(0);

  await page
    .getByRole("button", { name: "Tentar com outro e-mail" })
    .click();
  await page.getByLabel("E-mail").fill("missing@example.test");
  await page.getByRole("button", { name: "Enviar link" }).click();

  await expect(page.getByRole("status")).toHaveText(knownMessage ?? "");
});
~~~

- [ ] Step 2: Registrar o contrato no guia de identidade

Na seção REG-IDA-002, substituir a frase atual sobre o formulário público por:

~~~markdown
**Falhas:** sem Resend, recuperação de senha e e-mails de acesso falham; isso não reabre cadastro. O formulário público de recuperação sempre usa a mesma mensagem para Conta existente, inexistente ou falha de entrega, evitando enumeração visível no navegador. Depois de uma resposta aceita, ele substitui os campos por uma confirmação e só permite nova solicitação após a ação explícita de tentar com outro e-mail.
~~~

Na seção REG-IDA-007, acrescentar ao final do parágrafo sobre redefinição:

~~~markdown
Após uma redefinição bem-sucedida, a interface remove o formulário e oferece entrada pelo fluxo normal de login; o mesmo token não é submetido novamente pela tela.
~~~

- [ ] Step 3: Indexar o plano aprovado

Em docs/README.md, logo após o link da especificação 2026-09-03-action-outcome-and-password-recovery-ux-design.md, adicionar:

~~~markdown
- [Estados de conclusão de ações e recuperação de senha: plano](superpowers/plans/2026-09-03-action-outcome-and-password-recovery-ux.md)
~~~

- [ ] Step 4: Validar a documentação

Run:

~~~powershell
bun run docs:check
~~~

Expected: Documentação válida: 36 documentos canônicos.

### Task 6: Formatar e executar a verificação proporcional

**Files:**

- Verify: all files modified by Tasks 1–5.

- [ ] Step 1: Rodar o formatter/linter sem alterar escopo

Run:

~~~powershell
bun x ultracite fix
~~~

Expected: código formatado sem erros. Revisar imediatamente o diff para confirmar que somente os arquivos deste plano foram tocados.

- [ ] Step 2: Rodar os testes focais juntos

Run:

~~~powershell
bun run test -- "src/app/(auth)/recuperar-senha/request-password-reset-form.test.tsx" "src/app/(auth)/redefinir-senha/reset-password-form.test.tsx" "src/lib/auth-password-reset.test.ts"
~~~

Expected: todos os testes passam; o teste existente de entrega continua provando que falhas públicas são sanitizadas e assíncronas.

- [ ] Step 3: Rodar typecheck e lint

Run:

~~~powershell
bun run typecheck
bun run check
~~~

Expected: tsc --noEmit e ultracite check terminam com código 0.

- [ ] Step 4: Rodar a jornada E2E existente

Run:

~~~powershell
bun run test:e2e -- tests/e2e/critical-journeys.spec.ts
~~~

Expected: a jornada de login/recuperação passa com a confirmação terminal, retry explícito e mensagem idêntica para e-mail conhecido/desconhecido. Se o banco descartável ou os serviços E2E não estiverem disponíveis, registrar o comando e o erro exato sem declarar a jornada verificada.

- [ ] Step 5: Rodar o gate rápido final

Run:

~~~powershell
bun run verify:quick
~~~

Expected: todos os gates rápidos terminam com código 0.

## Revisão do plano

O mapeamento de erros do reset permanece consistente com a implementação:
`INVALID_TOKEN` oferece `/recuperar-senha`; `PASSWORD_TOO_LONG`, códigos
desconhecidos, `429`, `5xx`, corpos vazios ou malformados e erros de rede usam a
mensagem genérica sem link. O guard de token ausente mantém o link de
recuperação exigido pela especificação.

- Cobertura da especificação: estados terminais, retry explícito, prevenção de submissão concorrente, tratamento de rede, acessibilidade, anti-enumeração, documentação e verificação estão cobertos nas Tasks 1–6.
- Escopo: somente os dois formulários públicos são implementados; outros fluxos permanecem para a auditoria posterior prevista na especificação.
- Consistência: accepted é usado somente na solicitação de e-mail; success é usado somente na redefinição; respostas HTTP não aceitas e exceções de rede retornam ao formulário.
- Revisão de completude: não há marcadores incompletos ou passos sem arquivo, código ou comando definido.
