"use client";

import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  publishCertificateTemplateFormAction,
  saveCertificateTemplateDraftFormAction,
} from "@/features/admin/actions";
import { certificateTemplateInitialActionState } from "@/features/admin/certificate-template-action-state";
import { CertificateTemplateCropDialog } from "@/features/certificates/template-crop-dialog";
import { CERTIFICATE_IMAGE_ACCEPT } from "@/features/certificates/template-image-contract";
import {
  type CertificateTemplateField,
  type CertificateTemplateSpec,
  createDefaultCertificateTemplateFields,
} from "@/features/certificates/template-rules";
import { CertificateTemplatePreview } from "./certificate-template-preview";

export interface CertificateTemplateEditorTemplate {
  backgroundUrl: string;
  signatureKey: string | null;
  signatureUrl: string | null;
  signerName: string | null;
  signerRole: string | null;
  spec: CertificateTemplateSpec;
  status: "draft" | "published" | "superseded";
  version: number;
}

const fieldLabels: Record<CertificateTemplateField["field"], string> = {
  completedAt: "Conclusão",
  courseFreeStatement: "Texto de curso livre",
  courseTitle: "Curso",
  issuedAt: "Emissão",
  issuerCnpj: "CNPJ",
  issuerName: "Empresa",
  qrCode: "QR de validação",
  signatureImage: "Assinatura visual",
  signerName: "Responsável",
  studentName: "Nome da aluna",
  validationCode: "Código",
  workloadHours: "Carga horária",
};

export function CertificateTemplateForm({
  courseId,
  issuerConfigured,
  template,
}: {
  courseId: string;
  issuerConfigured: boolean;
  template: CertificateTemplateEditorTemplate | undefined;
}): React.JSX.Element {
  const [fields, setFields] = useState(
    template?.spec.fields ?? createDefaultCertificateTemplateFields
  );
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(
    template?.backgroundUrl ?? null
  );
  const [cropSource, setCropSource] = useState<File | null>(null);
  const [previewVariant, setPreviewVariant] = useState<"long" | "short">(
    "short"
  );
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(
    template?.signatureUrl ?? null
  );
  const backgroundInput = useRef<HTMLInputElement>(null);
  const [saveState, saveAction, isSaving] = useActionState(
    saveCertificateTemplateDraftFormAction,
    certificateTemplateInitialActionState
  );
  const [publishState, publishAction, isPublishing] = useActionState(
    publishCertificateTemplateFormAction.bind(null, courseId),
    certificateTemplateInitialActionState
  );

  useEffect(() => {
    if (saveState.status !== "idle" && saveState.message) {
      if (saveState.status === "success") {
        toast.success(saveState.message);
      } else {
        toast.error(saveState.message);
      }
    }
  }, [saveState]);

  useEffect(() => {
    if (publishState.status !== "idle" && publishState.message) {
      if (publishState.status === "success") {
        toast.success(publishState.message);
      } else {
        toast.error(publishState.message);
      }
    }
  }, [publishState]);

  useEffect(() => {
    if (!backgroundFile) {
      return;
    }
    const url = URL.createObjectURL(backgroundFile);
    setBackgroundUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [backgroundFile]);

  useEffect(() => {
    if (!signatureFile) {
      return;
    }
    const url = URL.createObjectURL(signatureFile);
    setSignatureUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [signatureFile]);

  const spec = useMemo<CertificateTemplateSpec>(
    () => ({ backgroundKey: template?.spec.backgroundKey ?? "", fields }),
    [fields, template?.spec.backgroundKey]
  );

  const updateField = <Key extends keyof CertificateTemplateField>(
    name: CertificateTemplateField["field"],
    key: Key,
    value: CertificateTemplateField[Key]
  ): void =>
    setFields((current) =>
      current.map((field) =>
        field.field === name ? { ...field, [key]: value } : field
      )
    );

  const useCrop = (file: File): void => {
    setBackgroundFile(file);
    if (backgroundInput.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      backgroundInput.current.files = dataTransfer.files;
    }
    setCropSource(null);
  };

  const isBusy = isSaving || isPublishing;

  return (
    <div className="flex flex-col gap-6">
      {issuerConfigured ? null : (
        <Alert variant="destructive">
          <AlertTitle>Perfil emissor pendente</AlertTitle>
          <AlertDescription>
            Cadastre razão social, nome de marca e CNPJ em Configurações antes
            de publicar.
          </AlertDescription>
        </Alert>
      )}
      {saveState.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>Rascunho não salvo</AlertTitle>
          <AlertDescription>{saveState.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col items-start gap-8 lg:flex-row">
        {/* Left Column: Fixed Preview */}
        <div className="flex w-full shrink-0 flex-col gap-6 lg:sticky lg:top-8 lg:w-[45%] xl:w-1/2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Simulação</CardTitle>
              <Button
                onClick={() =>
                  setPreviewVariant((current) =>
                    current === "short" ? "long" : "short"
                  )
                }
                size="sm"
                type="button"
                variant="outline"
              >
                Dados {previewVariant === "short" ? "longos" : "curtos"}
              </Button>
            </CardHeader>
            <CardContent>
              <CertificateTemplatePreview
                backgroundUrl={backgroundUrl}
                fields={fields}
                signatureUrl={signatureUrl}
                variant={previewVariant}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Scrollable Settings */}
        <div className="flex w-full flex-col gap-6 lg:w-[55%] xl:w-1/2">
          {/* Action Toolbar */}
          <div className="sticky top-8 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/95 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-sm">Status da arte</span>
              {template ? (
                <span className="text-muted-foreground text-xs">
                  Versão {template.version}{" "}
                  {template.status === "draft" ? "(Rascunho)" : "(Publicada)"}
                </span>
              ) : (
                <span className="text-muted-foreground text-xs">Novo</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <form action={saveAction} id="save-draft-form">
                <input name="courseId" type="hidden" value={courseId} />
                <input
                  name="signatureKey"
                  type="hidden"
                  value={template?.signatureKey ?? ""}
                />
                <input name="spec" type="hidden" value={JSON.stringify(spec)} />
              </form>
              <Button
                disabled={isBusy}
                form="save-draft-form"
                type="submit"
                variant="secondary"
              >
                {isSaving ? "Salvando..." : "Salvar rascunho"}
              </Button>
              <form action={publishAction}>
                <Button
                  disabled={!(issuerConfigured && template) || isBusy}
                  type="submit"
                  variant="default"
                >
                  {isPublishing ? "Publicando..." : "Publicar"}
                </Button>
              </form>
            </div>
          </div>
          <FieldError className="text-right">
            {saveState.fieldErrors?.template}
          </FieldError>

          <fieldset
            className="contents"
            disabled={isBusy}
            form="save-draft-form"
          >
            <Card>
              <CardHeader>
                <CardTitle>Configurações gerais</CardTitle>
                <CardDescription>
                  Arte recortada em A4 horizontal, assinaturas e nomes dos
                  responsáveis.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="certificate-background">
                      Arte A4 horizontal
                    </FieldLabel>
                    <Input
                      accept={CERTIFICATE_IMAGE_ACCEPT}
                      form="save-draft-form"
                      id="certificate-background"
                      name="background"
                      onChange={(event) =>
                        setCropSource(event.currentTarget.files?.[0] ?? null)
                      }
                      ref={backgroundInput}
                      required={
                        !(template?.spec.backgroundKey || backgroundFile)
                      }
                      type="file"
                    />
                    <FieldDescription>
                      PNG, JPEG ou WebP; o recorte será salvo como WebP privado.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="certificate-signature">
                      Assinatura visual
                    </FieldLabel>
                    <Input
                      accept={CERTIFICATE_IMAGE_ACCEPT}
                      form="save-draft-form"
                      id="certificate-signature"
                      name="signature"
                      onChange={(event) =>
                        setSignatureFile(event.currentTarget.files?.[0] ?? null)
                      }
                      type="file"
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="certificate-signer-name">
                        Responsável
                      </FieldLabel>
                      <Input
                        defaultValue={template?.signerName ?? ""}
                        form="save-draft-form"
                        id="certificate-signer-name"
                        name="signerName"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="certificate-signer-role">
                        Cargo
                      </FieldLabel>
                      <Input
                        defaultValue={template?.signerRole ?? ""}
                        form="save-draft-form"
                        id="certificate-signer-role"
                        name="signerRole"
                      />
                    </Field>
                  </div>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Campos padronizados</CardTitle>
                <CardDescription>
                  Ative somente o que deve aparecer e posicione cada elemento em
                  porcentagem da página.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 sm:px-6 sm:pb-6">
                <AccordionPrimitive.Root
                  className="w-full flex-col overflow-hidden sm:rounded-2xl sm:border"
                  type="multiple"
                >
                  {fields.map((field) => (
                    <AccordionPrimitive.Item
                      className="border-b transition-colors last:border-0 data-[state=open]:bg-muted/30"
                      key={field.field}
                      value={field.field}
                    >
                      <AccordionPrimitive.Header className="flex px-2 sm:px-4">
                        <div className="flex flex-1 items-center gap-3">
                          <Switch
                            checked={field.visible}
                            onCheckedChange={(checked) =>
                              updateField(field.field, "visible", checked)
                            }
                          />
                          <AccordionPrimitive.Trigger className="group/trigger relative flex flex-1 items-center justify-between py-4 text-left font-medium text-sm outline-none transition-all hover:underline disabled:pointer-events-none disabled:opacity-50">
                            {fieldLabels[field.field]}
                            <div className="flex items-center text-muted-foreground transition-transform">
                              <HugeiconsIcon
                                className="group-data-[state=open]/trigger:hidden"
                                icon={ArrowDown01Icon}
                                size={16}
                                strokeWidth={2}
                              />
                              <HugeiconsIcon
                                className="hidden group-data-[state=open]/trigger:block"
                                icon={ArrowUp01Icon}
                                size={16}
                                strokeWidth={2}
                              />
                            </div>
                          </AccordionPrimitive.Trigger>
                        </div>
                      </AccordionPrimitive.Header>
                      <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                        <div className="px-2 pb-5 sm:px-4">
                          <div className="grid gap-4 rounded-lg border bg-background p-4 sm:grid-cols-2">
                            <Field>
                              <FieldLabel>
                                Posição horizontal: {field.x}%
                              </FieldLabel>
                              <Slider
                                aria-label={`Posição horizontal de ${
                                  fieldLabels[field.field]
                                }`}
                                max={100 - field.width}
                                min={0}
                                onValueChange={(value) =>
                                  updateField(field.field, "x", value[0] ?? 0)
                                }
                                value={[field.x]}
                              />
                            </Field>
                            <Field>
                              <FieldLabel>
                                Posição vertical: {field.y}%
                              </FieldLabel>
                              <Slider
                                aria-label={`Posição vertical de ${
                                  fieldLabels[field.field]
                                }`}
                                max={100 - field.height}
                                min={0}
                                onValueChange={(value) =>
                                  updateField(field.field, "y", value[0] ?? 0)
                                }
                                value={[field.y]}
                              />
                            </Field>
                            <Field>
                              <FieldLabel>Largura: {field.width}%</FieldLabel>
                              <Slider
                                aria-label={`Largura de ${
                                  fieldLabels[field.field]
                                }`}
                                max={100 - field.x}
                                min={1}
                                onValueChange={(value) =>
                                  updateField(
                                    field.field,
                                    "width",
                                    value[0] ?? 1
                                  )
                                }
                                value={[field.width]}
                              />
                            </Field>
                            <Field>
                              <FieldLabel>Altura: {field.height}%</FieldLabel>
                              <Slider
                                aria-label={`Altura de ${
                                  fieldLabels[field.field]
                                }`}
                                max={100 - field.y}
                                min={1}
                                onValueChange={(value) =>
                                  updateField(
                                    field.field,
                                    "height",
                                    value[0] ?? 1
                                  )
                                }
                                value={[field.height]}
                              />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor={`${field.field}-size`}>
                                Tamanho da fonte
                              </FieldLabel>
                              <Input
                                id={`${field.field}-size`}
                                max={72}
                                min={6}
                                onChange={(event) =>
                                  updateField(
                                    field.field,
                                    "fontSize",
                                    Number(event.target.value)
                                  )
                                }
                                type="number"
                                value={field.fontSize}
                              />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor={`${field.field}-color`}>
                                Cor
                              </FieldLabel>
                              <Input
                                id={`${field.field}-color`}
                                onChange={(event) =>
                                  updateField(
                                    field.field,
                                    "color",
                                    event.target.value
                                  )
                                }
                                pattern="#[0-9a-fA-F]{6}"
                                value={field.color}
                              />
                            </Field>
                            <Field>
                              <FieldLabel>Alinhamento</FieldLabel>
                              <Select
                                onValueChange={(value) =>
                                  updateField(
                                    field.field,
                                    "align",
                                    value as CertificateTemplateField["align"]
                                  )
                                }
                                value={field.align}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectItem value="left">
                                      Esquerda
                                    </SelectItem>
                                    <SelectItem value="center">
                                      Centro
                                    </SelectItem>
                                    <SelectItem value="right">
                                      Direita
                                    </SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </Field>
                            <Field>
                              <FieldLabel>Fonte</FieldLabel>
                              <Select
                                onValueChange={(value) =>
                                  updateField(
                                    field.field,
                                    "font",
                                    value as NonNullable<
                                      CertificateTemplateField["font"]
                                    >
                                  )
                                }
                                value={field.font ?? "Helvetica"}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectItem value="Helvetica">
                                      Helvetica
                                    </SelectItem>
                                    <SelectItem value="Helvetica-Bold">
                                      Helvetica Bold
                                    </SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </Field>
                          </div>
                        </div>
                      </AccordionPrimitive.Content>
                    </AccordionPrimitive.Item>
                  ))}
                </AccordionPrimitive.Root>
              </CardContent>
            </Card>
          </fieldset>
        </div>
      </div>

      <CertificateTemplateCropDialog
        file={cropSource}
        onCancel={() => setCropSource(null)}
        onComplete={useCrop}
      />
    </div>
  );
}
