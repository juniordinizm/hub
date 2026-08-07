"use client";

import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { memo } from "react";
import { CertificateImageUploadField } from "@/components/certificate-image-upload-field";
import { Field, FieldLabel } from "@/components/ui/field";
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
import type { CertificateTemplateField } from "@/features/certificates/template-rules";
import { certificateTemplateFieldLabels } from "./certificate-template-field-labels";

export type CertificateFieldChange = <
  Key extends keyof CertificateTemplateField,
>(
  name: CertificateTemplateField["field"],
  key: Key,
  value: CertificateTemplateField[Key]
) => void;

interface CertificateTemplateFieldsProps {
  fields: CertificateTemplateField[];
  onFieldChange: CertificateFieldChange;
  onSignatureFileSelect: (file: File | null) => void;
  onSignerNameChange: (value: string) => void;
  onSignerRoleChange: (value: string) => void;
  signatureFile: File | null;
  signaturePreviewUrl: string | null;
  signerName: string;
  signerRole: string;
}

const CertificateFieldPositionControls = ({
  field,
  onFieldChange,
}: {
  field: CertificateTemplateField;
  onFieldChange: CertificateFieldChange;
}): React.JSX.Element => (
  <div className="grid gap-4 rounded-lg border bg-background p-4 xl:grid-cols-2">
    <Field>
      <FieldLabel>Horizontal: {field.x}%</FieldLabel>
      <Slider
        aria-label={`Posição horizontal de ${certificateTemplateFieldLabels[field.field]}`}
        max={100 - field.width}
        min={0}
        onValueChange={(value) =>
          onFieldChange(field.field, "x", value[0] ?? 0)
        }
        value={[field.x]}
      />
    </Field>
    <Field>
      <FieldLabel>Vertical: {field.y}%</FieldLabel>
      <Slider
        aria-label={`Posição vertical de ${certificateTemplateFieldLabels[field.field]}`}
        max={100 - field.height}
        min={0}
        onValueChange={(value) =>
          onFieldChange(field.field, "y", value[0] ?? 0)
        }
        value={[field.y]}
      />
    </Field>
    <Field>
      <FieldLabel>Largura: {field.width}%</FieldLabel>
      <Slider
        aria-label={`Largura de ${certificateTemplateFieldLabels[field.field]}`}
        max={100 - field.x}
        min={1}
        onValueChange={(value) =>
          onFieldChange(field.field, "width", value[0] ?? 1)
        }
        value={[field.width]}
      />
    </Field>
    <Field>
      <FieldLabel>Altura: {field.height}%</FieldLabel>
      <Slider
        aria-label={`Altura de ${certificateTemplateFieldLabels[field.field]}`}
        max={100 - field.y}
        min={1}
        onValueChange={(value) =>
          onFieldChange(field.field, "height", value[0] ?? 1)
        }
        value={[field.height]}
      />
    </Field>
    <Field>
      <FieldLabel htmlFor={`${field.field}-size`}>Tamanho da fonte</FieldLabel>
      <Input
        id={`${field.field}-size`}
        max={72}
        min={6}
        onChange={(event) =>
          onFieldChange(field.field, "fontSize", Number(event.target.value))
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
          onFieldChange(field.field, "color", event.target.value)
        }
        pattern="#[0-9a-fA-F]{6}"
        value={field.color}
      />
    </Field>
    <Field>
      <FieldLabel htmlFor={`${field.field}-align`}>Alinhamento</FieldLabel>
      <Select
        onValueChange={(value) =>
          onFieldChange(
            field.field,
            "align",
            value as CertificateTemplateField["align"]
          )
        }
        value={field.align}
      >
        <SelectTrigger id={`${field.field}-align`}>
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
      <FieldLabel htmlFor={`${field.field}-font`}>Fonte</FieldLabel>
      <Select
        onValueChange={(value) =>
          onFieldChange(
            field.field,
            "font",
            value as NonNullable<CertificateTemplateField["font"]>
          )
        }
        value={field.font ?? "Helvetica"}
      >
        <SelectTrigger id={`${field.field}-font`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="Helvetica">Helvetica</SelectItem>
            <SelectItem value="Helvetica-Bold">Helvetica Bold</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  </div>
);

type CertificateTemplateFieldItemProps = Omit<
  CertificateTemplateFieldsProps,
  "fields"
> & {
  field: CertificateTemplateField;
};

const CertificateTemplateFieldItem = memo(
  function CertificateTemplateFieldItem({
    field,
    onFieldChange,
    onSignatureFileSelect,
    onSignerNameChange,
    onSignerRoleChange,
    signatureFile,
    signaturePreviewUrl,
    signerName,
    signerRole,
  }: CertificateTemplateFieldItemProps): React.JSX.Element {
    return (
      <AccordionPrimitive.Item
        className="border-b transition-colors last:border-0 data-[state=open]:bg-muted/30"
        value={field.field}
      >
        <AccordionPrimitive.Header className="flex px-2 sm:px-4">
          <div className="flex flex-1 items-center gap-3">
            <Switch
              aria-label={`Exibir ${certificateTemplateFieldLabels[field.field]}`}
              checked={field.visible}
              onCheckedChange={(checked) =>
                onFieldChange(field.field, "visible", checked)
              }
            />
            <AccordionPrimitive.Trigger className="group/trigger relative flex min-h-10 flex-1 items-center justify-between rounded-md py-4 text-left font-medium text-sm outline-none transition-[color] hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
              {certificateTemplateFieldLabels[field.field]}
              <span className="flex items-center text-muted-foreground">
                <HugeiconsIcon
                  className="group-data-[state=open]/trigger:hidden"
                  icon={ArrowDown01Icon}
                />
                <HugeiconsIcon
                  className="hidden group-data-[state=open]/trigger:block"
                  icon={ArrowUp01Icon}
                />
              </span>
            </AccordionPrimitive.Trigger>
          </div>
        </AccordionPrimitive.Header>
        <AccordionPrimitive.Content
          className="overflow-hidden data-[state=closed]:hidden data-[state=open]:animate-accordion-down"
          forceMount
        >
          <div className="px-2 pb-5 sm:px-4">
            {field.field === "signerName" ? (
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="certificate-signer-name">
                    Nome do responsável
                  </FieldLabel>
                  <Input
                    id="certificate-signer-name"
                    name="signerName"
                    onChange={(event) => onSignerNameChange(event.target.value)}
                    value={signerName}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="certificate-signer-role">
                    Cargo
                  </FieldLabel>
                  <Input
                    id="certificate-signer-role"
                    name="signerRole"
                    onChange={(event) => onSignerRoleChange(event.target.value)}
                    value={signerRole}
                  />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel
                    className="mb-2 block"
                    htmlFor="certificate-signature"
                  >
                    Imagem da assinatura
                  </FieldLabel>
                  <CertificateImageUploadField
                    className="max-w-sm"
                    id="certificate-signature"
                    imageUrl={signaturePreviewUrl}
                    kind="signature"
                    label="Arraste a assinatura (fundo transparente)"
                    onFileSelect={onSignatureFileSelect}
                    selectedFile={signatureFile}
                  />
                </Field>
              </div>
            ) : null}
            <CertificateFieldPositionControls
              field={field}
              onFieldChange={onFieldChange}
            />
          </div>
        </AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    );
  }
);

export const CertificateTemplateFields = memo(
  function CertificateTemplateFields({
    fields,
    ...props
  }: CertificateTemplateFieldsProps): React.JSX.Element {
    return (
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="font-semibold text-base">Campos padronizados</h3>
          <p className="mt-1 text-muted-foreground text-sm">
            Ligue os dados que deseja exibir e edite a posição.
          </p>
        </div>
        <AccordionPrimitive.Root
          className="w-full flex-col overflow-hidden sm:rounded-2xl sm:border"
          type="multiple"
        >
          {fields.map((field) => (
            <CertificateTemplateFieldItem
              {...props}
              field={field}
              key={field.field}
            />
          ))}
        </AccordionPrimitive.Root>
      </section>
    );
  }
);
