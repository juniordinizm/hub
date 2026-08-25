"use client";

import Image from "next/image";
import QRCode from "qrcode";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { createTotpVerificationInput } from "@/lib/two-factor-policy";

interface TwoFactorSetupFormProps {
  readonly mode: "recovery" | "setup";
}

interface ProvisioningData {
  backupCodes: string[];
  qrDataUrl: string;
  secret: string;
  totpUri: string;
}

type SetupStage = "password" | "provision" | "recovery_codes";

const readTotpSecret = (totpUri: string): string => {
  try {
    return new URL(totpUri).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
};

const redirectAfterAuthentication = async (): Promise<void> => {
  const response = await fetch("/api/auth/redirect", {
    credentials: "same-origin",
  });
  const payload = response.ok
    ? ((await response.json()) as { redirectTo?: string })
    : null;
  window.location.assign(payload?.redirectTo ?? "/admin");
};

export function TwoFactorSetupForm({
  mode,
}: TwoFactorSetupFormProps): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [password, setPassword] = useState("");
  const [provisioning, setProvisioning] = useState<ProvisioningData | null>(
    null
  );
  const [stage, setStage] = useState<SetupStage>("password");
  const [storedCodes, setStoredCodes] = useState(false);
  const errorTargetRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (error) {
      errorTargetRef.current?.focus();
    }
  }, [error]);

  const handlePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsPending(true);
    const currentPassword = String(
      new FormData(event.currentTarget).get("password") ?? ""
    );

    try {
      const result =
        mode === "setup"
          ? await authClient.twoFactor.enable({ password: currentPassword })
          : await authClient.twoFactor.getTotpUri({
              password: currentPassword,
            });
      const totpUri = result.data?.totpURI;

      if (result.error || !totpUri) {
        setError("Não foi possível confirmar a operação. Tente novamente.");
        return;
      }

      const qrDataUrl = await QRCode.toDataURL(totpUri, {
        margin: 1,
        width: 240,
      });
      const backupCodes =
        mode === "setup" &&
        "backupCodes" in result.data &&
        Array.isArray(result.data.backupCodes)
          ? result.data.backupCodes.filter(
              (code): code is string => typeof code === "string"
            )
          : [];

      setPassword(currentPassword);
      setProvisioning({
        backupCodes,
        qrDataUrl,
        secret: readTotpSecret(totpUri),
        totpUri,
      });
      setStage("provision");
    } catch {
      setError("Não foi possível confirmar a operação. Tente novamente.");
    } finally {
      setIsPending(false);
    }
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (mode === "setup" && !storedCodes) {
      setError("Confirme que guardou os códigos de recuperação.");
      return;
    }

    setIsPending(true);
    const code = String(new FormData(event.currentTarget).get("code") ?? "");

    try {
      const verification = await authClient.twoFactor.verifyTotp(
        createTotpVerificationInput(code)
      );

      if (verification.error) {
        setError("Não foi possível validar o código. Tente novamente.");
        return;
      }

      if (mode === "recovery") {
        const generated = await authClient.twoFactor.generateBackupCodes({
          password,
        });

        if (generated.error || !generated.data?.backupCodes) {
          setError("Não foi possível renovar os códigos de recuperação.");
          return;
        }

        setPassword("");
        setStoredCodes(false);
        setProvisioning((current) =>
          current
            ? { ...current, backupCodes: generated.data.backupCodes }
            : current
        );
        setStage("recovery_codes");
        return;
      }

      setPassword("");
      setProvisioning(null);
      await redirectAfterAuthentication();
    } catch {
      setError("Não foi possível validar o código. Tente novamente.");
    } finally {
      setIsPending(false);
    }
  };

  const handleRecoveryComplete = async () => {
    if (!storedCodes) {
      setError("Confirme que guardou os novos códigos de recuperação.");
      return;
    }

    setProvisioning(null);
    await redirectAfterAuthentication();
  };

  if (stage === "password") {
    return (
      <form onSubmit={handlePassword}>
        <Field>
          <FieldLabel htmlFor="two-factor-password">Senha atual</FieldLabel>
          <Input
            autoComplete="current-password"
            id="two-factor-password"
            minLength={PASSWORD_MIN_LENGTH}
            name="password"
            ref={errorTargetRef}
            required
            type="password"
          />
        </Field>
        {error ? (
          <Alert aria-live="assertive" className="mt-5" variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button className="mt-5 h-12 w-full" disabled={isPending} type="submit">
          {isPending ? "Confirmando..." : "Continuar"}
        </Button>
      </form>
    );
  }

  if (!provisioning) {
    return <p role="status">Reinicie a configuração do segundo fator.</p>;
  }

  if (stage === "recovery_codes") {
    return (
      <div className="space-y-5">
        <RecoveryCodes codes={provisioning.backupCodes} />
        <StorageConfirmation checked={storedCodes} onChecked={setStoredCodes} />
        {error ? (
          <Alert aria-live="assertive" variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button className="h-12 w-full" onClick={handleRecoveryComplete}>
          Concluir recuperação
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleVerify}>
      <div className="grid gap-5 sm:grid-cols-[240px_1fr]">
        <Image
          alt="QR code para cadastrar o segundo fator"
          className="rounded-lg border bg-white"
          height={240}
          src={provisioning.qrDataUrl}
          unoptimized
          width={240}
        />
        <div className="space-y-3">
          <p className="font-medium text-sm">Configuração manual</p>
          <p className="text-muted-foreground text-sm">
            Se não puder ler o QR, informe este segredo no autenticador:
          </p>
          <code className="block break-all rounded-md bg-muted p-3 text-sm">
            {provisioning.secret}
          </code>
        </div>
      </div>

      {mode === "setup" ? (
        <>
          <RecoveryCodes codes={provisioning.backupCodes} />
          <StorageConfirmation
            checked={storedCodes}
            onChecked={setStoredCodes}
          />
        </>
      ) : null}

      <Field>
        <FieldLabel htmlFor="setup-totp-code">
          Código do autenticador
        </FieldLabel>
        <Input
          autoComplete="one-time-code"
          id="setup-totp-code"
          inputMode="numeric"
          maxLength={6}
          minLength={6}
          name="code"
          pattern="[0-9]{6}"
          ref={errorTargetRef}
          required
        />
      </Field>
      {error ? (
        <Alert aria-live="assertive" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button className="h-12 w-full" disabled={isPending} type="submit">
        {isPending ? "Validando..." : "Validar e ativar"}
      </Button>
    </form>
  );
}

function RecoveryCodes({
  codes,
}: {
  readonly codes: readonly string[];
}): React.JSX.Element {
  return (
    <section aria-labelledby="recovery-codes-title" className="space-y-3">
      <h2 className="font-semibold" id="recovery-codes-title">
        Códigos de recuperação
      </h2>
      <p className="text-muted-foreground text-sm">
        Cada código funciona uma vez. Guarde-os agora fora do Hub; eles não
        serão mostrados novamente depois desta tela.
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-4 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
    </section>
  );
}

function StorageConfirmation({
  checked,
  onChecked,
}: {
  readonly checked: boolean;
  readonly onChecked: (checked: boolean) => void;
}): React.JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        aria-describedby="stored-codes-description"
        checked={checked}
        id="stored-codes"
        onCheckedChange={(value) => onChecked(value === true)}
      />
      <div>
        <label className="font-medium text-sm" htmlFor="stored-codes">
          Guardei os códigos em local seguro
        </label>
        <p
          className="text-muted-foreground text-sm"
          id="stored-codes-description"
        >
          O Hub não oferece uma segunda cópia depois que você sair desta tela.
        </p>
      </div>
    </div>
  );
}
