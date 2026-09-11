"use client";

import { FloppyDiskIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import {
  AdminMutationForm,
  AdminMutationSubmitButton,
  useAdminMutationFormState,
} from "@/components/admin-mutation-form";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveSettingsAction } from "@/features/admin/actions";
import { formatCnpjInput } from "@/lib/cnpj";

export interface CertificateSettingsFormValues {
  certificateSignerName: string | null;
  certificateSignerRole: string | null;
  issuerCnpj: string | null;
  issuerDisplayName: string | null;
  issuerLegalName: string | null;
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Não foi possível salvar.";

const getSettingsFieldErrors = (error: unknown): Record<string, string> => {
  const message = getErrorMessage(error);
  if (message.includes("razão social e CNPJ")) {
    return {
      issuerCnpj: message,
      issuerLegalName: message,
    };
  }
  if (message.includes("CNPJ válido")) {
    return { issuerCnpj: message };
  }
  return {};
};

function CertificateSettingsFields({
  settings,
}: {
  settings: CertificateSettingsFormValues;
}): React.JSX.Element {
  const { fieldErrors } = useAdminMutationFormState();
  const [cnpj, setCnpj] = useState(() =>
    formatCnpjInput(settings.issuerCnpj ?? "")
  );
  const legalNameError = fieldErrors.issuerLegalName;
  const cnpjError = fieldErrors.issuerCnpj;

  return (
    <FieldGroup>
      <FieldSet className="gap-4">
        <FieldLegend variant="label">Instituição emissora</FieldLegend>
        <FieldDescription>
          Razão social e CNPJ são obrigatórios juntos para manter o perfil
          pronto para novas emissões.
        </FieldDescription>
        <div className="grid gap-5 md:grid-cols-2">
          <Field data-invalid={Boolean(legalNameError)}>
            <FieldLabel htmlFor="issuer-legal-name">
              Razão social emissora
            </FieldLabel>
            <Input
              aria-describedby={
                legalNameError ? "issuer-legal-name-error" : undefined
              }
              aria-invalid={legalNameError ? true : undefined}
              autoComplete="organization"
              defaultValue={settings.issuerLegalName ?? ""}
              id="issuer-legal-name"
              name="issuerLegalName"
              required
            />
            {legalNameError ? (
              <FieldError id="issuer-legal-name-error">
                {legalNameError}
              </FieldError>
            ) : null}
          </Field>
          <Field data-invalid={Boolean(cnpjError)}>
            <FieldLabel htmlFor="issuer-cnpj">CNPJ emissor</FieldLabel>
            <Input
              aria-describedby={
                cnpjError
                  ? "issuer-cnpj-description issuer-cnpj-error"
                  : "issuer-cnpj-description"
              }
              aria-invalid={cnpjError ? true : undefined}
              autoComplete="organization"
              id="issuer-cnpj"
              inputMode="numeric"
              maxLength={18}
              name="issuerCnpj"
              onChange={(event) => setCnpj(formatCnpjInput(event.target.value))}
              placeholder="00.000.000/0000-00"
              required
              value={cnpj}
            />
            <FieldDescription id="issuer-cnpj-description">
              Informe os 14 dígitos; a máscara é aplicada automaticamente.
            </FieldDescription>
            {cnpjError ? (
              <FieldError id="issuer-cnpj-error">{cnpjError}</FieldError>
            ) : null}
          </Field>
          <Field className="md:col-span-2">
            <FieldLabel htmlFor="issuer-display-name">Marca exibida</FieldLabel>
            <Input
              autoComplete="organization"
              defaultValue={settings.issuerDisplayName ?? ""}
              id="issuer-display-name"
              name="issuerDisplayName"
            />
          </Field>
        </div>
      </FieldSet>

      <FieldSeparator />

      <FieldSet className="gap-4">
        <FieldLegend variant="label">Assinatura padrão</FieldLegend>
        <FieldDescription>
          Usada quando o Curso não define uma assinatura própria.
        </FieldDescription>
        <div className="grid gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="certificate-signer-name">
              Nome da assinatura
            </FieldLabel>
            <Input
              autoComplete="name"
              defaultValue={settings.certificateSignerName ?? ""}
              id="certificate-signer-name"
              name="certificateSignerName"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="certificate-signer-role">
              Cargo da assinatura
            </FieldLabel>
            <Input
              autoComplete="organization-title"
              defaultValue={settings.certificateSignerRole ?? ""}
              id="certificate-signer-role"
              name="certificateSignerRole"
            />
          </Field>
        </div>
      </FieldSet>

      <AdminMutationSubmitButton className="w-full sm:w-fit" type="submit">
        <HugeiconsIcon
          aria-hidden="true"
          data-icon="inline-start"
          icon={FloppyDiskIcon}
          size={18}
          strokeWidth={2}
        />
        Salvar configurações
      </AdminMutationSubmitButton>
    </FieldGroup>
  );
}

export function CertificateSettingsForm({
  settings,
}: {
  settings: CertificateSettingsFormValues;
}): React.JSX.Element {
  return (
    <AdminMutationForm
      action={saveSettingsAction}
      getFieldErrors={getSettingsFieldErrors}
    >
      <CertificateSettingsFields settings={settings} />
    </AdminMutationForm>
  );
}
