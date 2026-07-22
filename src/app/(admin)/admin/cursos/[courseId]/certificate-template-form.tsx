"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Separator } from "@/components/ui/separator";
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
  completedAt: "Conclusao",
  courseFreeStatement: "Texto de curso livre",
  courseTitle: "Curso",
  issuedAt: "Emissao",
  issuerCnpj: "CNPJ",
  issuerName: "Empresa",
  qrCode: "QR de validacao",
  signatureImage: "Assinatura visual",
  signerName: "Responsavel",
  studentName: "Nome da aluna",
  validationCode: "Codigo",
  workloadHours: "Carga horaria",
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

  return (
    <div className="flex flex-col gap-6">
      {issuerConfigured ? null : (
        <Alert variant="destructive">
          <AlertTitle>Perfil emissor pendente</AlertTitle>
          <AlertDescription>
            Cadastre razao social, nome de marca e CNPJ em Configuracoes antes
            de publicar.
          </AlertDescription>
        </Alert>
      )}
      {saveState.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>Rascunho nao salvo</AlertTitle>
          <AlertDescription>{saveState.message}</AlertDescription>
        </Alert>
      ) : null}
      <form action={saveAction} className="flex flex-col gap-6">
        <input name="courseId" type="hidden" value={courseId} />
        <input
          name="signatureKey"
          type="hidden"
          value={template?.signatureKey ?? ""}
        />
        <input name="spec" type="hidden" value={JSON.stringify(spec)} />
        <Card>
          <CardHeader>
            <CardTitle>Arte e simulacao</CardTitle>
            <CardDescription>
              A arte e recortada em A4 horizontal antes do envio. A simulacao
              usa os mesmos campos do PDF.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <CertificateTemplatePreview
              backgroundUrl={backgroundUrl}
              fields={fields}
              signatureUrl={signatureUrl}
              variant={previewVariant}
            />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="certificate-background">
                  Arte A4 horizontal
                </FieldLabel>
                <Input
                  accept={CERTIFICATE_IMAGE_ACCEPT}
                  id="certificate-background"
                  name="background"
                  onChange={(event) =>
                    setCropSource(event.currentTarget.files?.[0] ?? null)
                  }
                  ref={backgroundInput}
                  required={!(template?.spec.backgroundKey || backgroundFile)}
                  type="file"
                />
                <FieldDescription>
                  PNG, JPEG ou WebP; o recorte sera salvo como WebP privado.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="certificate-signer-name">
                  Responsavel
                </FieldLabel>
                <Input
                  defaultValue={template?.signerName ?? ""}
                  id="certificate-signer-name"
                  name="signerName"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="certificate-signer-role">Cargo</FieldLabel>
                <Input
                  defaultValue={template?.signerRole ?? ""}
                  id="certificate-signer-role"
                  name="signerRole"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="certificate-signature">
                  Assinatura visual
                </FieldLabel>
                <Input
                  accept={CERTIFICATE_IMAGE_ACCEPT}
                  id="certificate-signature"
                  name="signature"
                  onChange={(event) =>
                    setSignatureFile(event.currentTarget.files?.[0] ?? null)
                  }
                  type="file"
                />
              </Field>
              <Field>
                <FieldLabel>Dados de teste</FieldLabel>
                <Button
                  onClick={() =>
                    setPreviewVariant((current) =>
                      current === "short" ? "long" : "short"
                    )
                  }
                  type="button"
                  variant="outline"
                >
                  Mostrar dados{" "}
                  {previewVariant === "short" ? "longos" : "curtos"}
                </Button>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Campos padronizados</CardTitle>
            <CardDescription>
              Ative somente o que deve aparecer e posicione cada elemento em
              porcentagem da pagina.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {fields.map((field) => (
              <FieldGroup className="rounded-lg border p-4" key={field.field}>
                <Field orientation="horizontal">
                  <FieldLabel htmlFor={`${field.field}-visible`}>
                    {fieldLabels[field.field]}
                  </FieldLabel>
                  <Switch
                    checked={field.visible}
                    id={`${field.field}-visible`}
                    onCheckedChange={(checked) =>
                      updateField(field.field, "visible", checked)
                    }
                  />
                </Field>
                <Separator />
                <Field>
                  <FieldLabel>Posicao horizontal: {field.x}%</FieldLabel>
                  <Slider
                    aria-label={`Posicao horizontal de ${fieldLabels[field.field]}`}
                    max={100 - field.width}
                    min={0}
                    onValueChange={(value) =>
                      updateField(field.field, "x", value[0] ?? 0)
                    }
                    value={[field.x]}
                  />
                </Field>
                <Field>
                  <FieldLabel>Posicao vertical: {field.y}%</FieldLabel>
                  <Slider
                    aria-label={`Posicao vertical de ${fieldLabels[field.field]}`}
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
                    aria-label={`Largura de ${fieldLabels[field.field]}`}
                    max={100 - field.x}
                    min={1}
                    onValueChange={(value) =>
                      updateField(field.field, "width", value[0] ?? 1)
                    }
                    value={[field.width]}
                  />
                </Field>
                <Field>
                  <FieldLabel>Altura: {field.height}%</FieldLabel>
                  <Slider
                    aria-label={`Altura de ${fieldLabels[field.field]}`}
                    max={100 - field.y}
                    min={1}
                    onValueChange={(value) =>
                      updateField(field.field, "height", value[0] ?? 1)
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
                  <FieldLabel htmlFor={`${field.field}-color`}>Cor</FieldLabel>
                  <Input
                    id={`${field.field}-color`}
                    onChange={(event) =>
                      updateField(field.field, "color", event.target.value)
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
                        <SelectItem value="left">Esquerda</SelectItem>
                        <SelectItem value="center">Centro</SelectItem>
                        <SelectItem value="right">Direita</SelectItem>
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
                        value as NonNullable<CertificateTemplateField["font"]>
                      )
                    }
                    value={field.font ?? "Helvetica"}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="Helvetica">Helvetica</SelectItem>
                        <SelectItem value="Helvetica-Bold">
                          Helvetica Bold
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
            ))}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-3">
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Salvando..." : "Salvar rascunho"}
            </Button>
            {template ? (
              <Badge variant="secondary">Versao {template.version}</Badge>
            ) : null}
            <FieldError>{saveState.fieldErrors?.template}</FieldError>
          </CardFooter>
        </Card>
      </form>
      <Card>
        <CardHeader>
          <CardTitle>Publicacao</CardTitle>
          <CardDescription>
            Publicar afeta somente proximas emissoes. Certificados ja emitidos
            permanecem imutaveis.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <form action={publishAction}>
            <Button
              disabled={!(issuerConfigured && template) || isPublishing}
              type="submit"
            >
              {isPublishing ? "Publicando..." : "Publicar certificado"}
            </Button>
          </form>
        </CardFooter>
      </Card>
      <CertificateTemplateCropDialog
        file={cropSource}
        onCancel={() => setCropSource(null)}
        onComplete={useCrop}
      />
    </div>
  );
}
