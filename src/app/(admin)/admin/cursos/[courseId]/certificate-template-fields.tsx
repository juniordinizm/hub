"use client";

import {
  AlignBottomIcon,
  AlignHorizontalCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AlignTopIcon,
  AlignVerticalCenterIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { memo, useEffect, useRef, useState } from "react";
import { CertificateImageUploadField } from "@/components/certificate-image-upload-field";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  CertificateField,
  CertificateTemplateField,
} from "@/features/certificates/template-rules";
import { certificateTemplateFieldLabels } from "./certificate-template-field-labels";
import { getCertificateFieldMetadata } from "./certificate-template-field-metadata";

export type CertificateFieldChange = <
  Key extends keyof CertificateTemplateField,
>(
  name: CertificateTemplateField["field"],
  key: Key,
  value: CertificateTemplateField[Key]
) => void;

interface CertificateTemplateFieldsProps {
  backgroundFile: File | null;
  backgroundImageName?: string | null | undefined;
  backgroundPreviewUrl: string | null;
  backgroundSelected: boolean;
  fields: CertificateTemplateField[];
  formId: string;
  onBackgroundFileSelect: (file: File | null) => void;
  onFieldChange: CertificateFieldChange;
  onFieldInteractionEnd: ((committed: boolean) => void) | undefined;
  onFieldInteractionStart: (() => void) | undefined;
  onFieldSelect: (field: CertificateField | null) => void;
  onSignatureFileSelect: (file: File | null) => void;
  onSignerNameChange: (value: string) => void;
  onSignerRoleChange: (value: string) => void;
  selectedField: CertificateField | null;
  signatureFile: File | null;
  signatureImageName?: string | null | undefined;
  signaturePreviewUrl: string | null;
  signerName: string;
  signerRole: string;
}

type GeometryKey = "height" | "width" | "x" | "y";

const geometryLabels: Record<GeometryKey, string> = {
  height: "Altura",
  width: "Largura",
  x: "Horizontal",
  y: "Vertical",
};

const isTextField = (field: CertificateField): boolean =>
  field !== "qrCode" && field !== "signatureImage";

const getGeometryBounds = (
  field: CertificateTemplateField,
  key: GeometryKey
): { max: number; min: number } => {
  if (key === "x") {
    return { max: Math.max(0, 100 - field.width), min: 0 };
  }
  if (key === "y") {
    return { max: Math.max(0, 100 - field.height), min: 0 };
  }
  if (key === "width") {
    const center = field.x + field.width / 2;
    return {
      max: Math.max(1, 2 * Math.min(center, 100 - center)),
      min: 1,
    };
  }
  const center = field.y + field.height / 2;
  return {
    max: Math.max(1, 2 * Math.min(center, 100 - center)),
    min: 1,
  };
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const formatNumericValue = (value: number): string => String(Math.round(value));

const InlinePropertyRow = ({
  children,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  label: string;
}): React.JSX.Element => (
  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,12rem)] items-center gap-3">
    {htmlFor ? (
      <FieldLabel
        className="truncate text-muted-foreground text-xs"
        htmlFor={htmlFor}
      >
        {label}
      </FieldLabel>
    ) : (
      <span className="truncate text-muted-foreground text-xs">{label}</span>
    )}
    <div className="min-w-0">{children}</div>
  </div>
);

interface NumericDraftInputProps
  extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  max: number;
  min: number;
  onCommit: (value: number) => void;
  onInteractionEnd?: ((committed: boolean) => void) | undefined;
  onInteractionStart?: (() => void) | undefined;
  step: number;
  value: number;
}

const NumericDraftInput = ({
  max,
  min,
  onCommit,
  onInteractionEnd,
  onInteractionStart,
  step,
  value,
  ...props
}: NumericDraftInputProps): React.JSX.Element => {
  const [draft, setDraft] = useState(() => formatNumericValue(value));

  useEffect(() => {
    setDraft(formatNumericValue(value));
  }, [value]);

  const commit = (): void => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(formatNumericValue(value));
      onInteractionEnd?.(false);
      return;
    }
    const next = clamp(parsed, min, max);
    const changed = next !== value;
    setDraft(formatNumericValue(next));
    if (changed) {
      onCommit(next);
    }
    onInteractionEnd?.(changed);
  };

  return (
    <Input
      {...props}
      inputMode={step < 1 ? "decimal" : "numeric"}
      max={max}
      min={min}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={onInteractionStart}
      onInput={(event) => setDraft(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setDraft(formatNumericValue(value));
          event.currentTarget.blur();
        }
      }}
      step={step}
      type="number"
      value={draft}
    />
  );
};

const GeometryControl = ({
  field,
  keyName,
  onFieldChange,
  onFieldInteractionEnd,
  onFieldInteractionStart,
}: {
  field: CertificateTemplateField;
  keyName: GeometryKey;
  onFieldChange: CertificateFieldChange;
  onFieldInteractionEnd: ((committed: boolean) => void) | undefined;
  onFieldInteractionStart: (() => void) | undefined;
}): React.JSX.Element => {
  const value = Math.round(field[keyName]);
  const bounds = getGeometryBounds(field, keyName);
  const interactionStarted = useRef(false);
  const id = `${field.field}-${keyName}`;
  const update = (nextValue: number): void => {
    onFieldChange(
      field.field,
      keyName,
      Math.round(clamp(nextValue, bounds.min, bounds.max)) as never
    );
  };
  const startInteraction = (): void => {
    if (interactionStarted.current) {
      return;
    }
    interactionStarted.current = true;
    onFieldInteractionStart?.();
  };
  const commitInteraction = (): void => {
    if (!interactionStarted.current) {
      return;
    }
    interactionStarted.current = false;
    onFieldInteractionEnd?.(true);
  };

  const commitInputInteraction = (committed: boolean): void => {
    interactionStarted.current = false;
    onFieldInteractionEnd?.(committed);
  };

  return (
    <Field className="gap-1.5" data-geometry-control={id}>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={id}>{geometryLabels[keyName]}</FieldLabel>
        <div className="flex h-10 items-center rounded-md border border-input bg-background px-1 lg:h-7">
          <NumericDraftInput
            aria-label={`${geometryLabels[keyName]} em porcentagem da página A4`}
            className="h-9 w-12 border-0 bg-transparent px-1 text-right font-mono text-base shadow-none focus-visible:ring-0 lg:h-6 lg:text-xs"
            id={id}
            max={bounds.max}
            min={bounds.min}
            onCommit={update}
            onInteractionEnd={commitInputInteraction}
            onInteractionStart={startInteraction}
            step={1}
            value={value}
          />
        </div>
      </div>
      <div className="relative min-w-0">
        <Slider
          aria-label={`${geometryLabels[keyName]} em porcentagem da página A4`}
          className="min-w-0"
          data-geometry-slider={id}
          max={bounds.max}
          min={bounds.min}
          onValueChange={(values) => {
            const nextValue = values[0];
            if (nextValue === undefined) {
              return;
            }
            startInteraction();
            update(nextValue);
          }}
          onValueCommit={commitInteraction}
          step={1}
          thumbValueTexts={[`${value}%`]}
          value={[value]}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 h-2 w-px -translate-y-1/2 bg-muted-foreground/50"
        />
      </div>
    </Field>
  );
};

const SignatureRelatedFields = ({
  onFieldSelect,
}: {
  onFieldSelect: (field: CertificateField) => void;
}): React.JSX.Element => (
  <div className="flex min-w-0 flex-wrap items-center gap-1.5 border-t pt-3">
    <span className="mr-1 text-muted-foreground text-xs">
      Bloco de assinatura:
    </span>
    {(["signerName", "signerRole", "signatureImage"] as const).map((field) => (
      <Button
        className="text-muted-foreground hover:text-foreground"
        key={field}
        onClick={() => onFieldSelect(field)}
        size="xs"
        type="button"
        variant="ghost"
      >
        {certificateTemplateFieldLabels[field]}
      </Button>
    ))}
  </div>
);

const AlignmentToggle = ({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{
    icon: typeof AlignLeftIcon;
    label: string;
    value: string;
  }>;
  value: string;
}): React.JSX.Element => (
  <fieldset data-alignment-row="true">
    <legend className="sr-only">{label}</legend>
    <div className="grid min-h-7 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <span className="truncate text-muted-foreground text-xs">{label}</span>
      <TooltipProvider delayDuration={250}>
        <div className="flex items-center gap-0.5 rounded-md border bg-muted/40 p-0.5">
          {options.map((option) => (
            <Tooltip key={option.value}>
              <TooltipTrigger asChild>
                <Button
                  aria-label={option.label}
                  aria-pressed={value === option.value}
                  className="size-11 lg:size-6"
                  data-alignment-option={option.value}
                  onClick={() => onChange(option.value)}
                  size="icon-xs"
                  type="button"
                  variant={value === option.value ? "secondary" : "ghost"}
                >
                  <HugeiconsIcon icon={option.icon} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {option.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  </fieldset>
);

const CertificateFieldInspector = ({
  field,
  formId,
  onFieldChange,
  onFieldInteractionEnd,
  onFieldInteractionStart,
  onFieldSelect,
  onSignatureFileSelect,
  onSignerNameChange,
  onSignerRoleChange,
  signatureFile,
  signatureImageName,
  signaturePreviewUrl,
  signerName,
  signerRole,
}: Omit<
  CertificateTemplateFieldsProps,
  | "backgroundFile"
  | "backgroundImageName"
  | "backgroundPreviewUrl"
  | "backgroundSelected"
  | "fields"
  | "onBackgroundFileSelect"
  | "selectedField"
> & {
  field: CertificateTemplateField;
}): React.JSX.Element => {
  const label = certificateTemplateFieldLabels[field.field];
  const metadata = getCertificateFieldMetadata(field.field);
  const showTypography = isTextField(field.field);
  const isSignatureField =
    field.field === "signerName" ||
    field.field === "signerRole" ||
    field.field === "signatureImage";
  return (
    <div
      className="flex min-w-0 flex-col gap-4"
      data-field-inspector={field.field}
    >
      <div className="flex items-start justify-between gap-3 border-b pb-3">
        <div>
          <h4 className="text-balance font-semibold text-sm">{label}</h4>
          <p className="mt-1 text-muted-foreground text-xs">
            {metadata.description}
          </p>
        </div>
      </div>

      {field.field === "signerName" ? (
        <InlinePropertyRow
          htmlFor="certificate-signer-name"
          label="Nome do responsável"
        >
          <Input
            autoComplete="name"
            className="h-10 text-base lg:h-7 lg:text-xs"
            form={formId}
            id="certificate-signer-name"
            name="signerName"
            onChange={(event) => onSignerNameChange(event.target.value)}
            value={signerName}
          />
        </InlinePropertyRow>
      ) : null}

      {field.field === "signerRole" ? (
        <InlinePropertyRow htmlFor="certificate-signer-role" label="Cargo">
          <Input
            autoComplete="organization-title"
            className="h-10 text-base lg:h-7 lg:text-xs"
            form={formId}
            id="certificate-signer-role"
            name="signerRole"
            onChange={(event) => onSignerRoleChange(event.target.value)}
            value={signerRole}
          />
        </InlinePropertyRow>
      ) : null}

      {field.field === "signatureImage" ? (
        <InlinePropertyRow
          htmlFor="certificate-signature"
          label="Imagem da assinatura"
        >
          <CertificateImageUploadField
            compactWhenImage
            form={formId}
            id="certificate-signature"
            imageName={signatureImageName}
            imageUrl={signaturePreviewUrl}
            kind="signature"
            label="Adicionar assinatura"
            onFileSelect={onSignatureFileSelect}
            selectedFile={signatureFile}
          />
        </InlinePropertyRow>
      ) : null}

      {isSignatureField ? (
        <SignatureRelatedFields onFieldSelect={onFieldSelect} />
      ) : null}

      <fieldset
        className="flex flex-col gap-2.5 border-t pt-3"
        data-geometry-group="position"
      >
        <legend className="font-medium text-sm">Posição</legend>
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          {(["x", "y"] as const).map((keyName) => (
            <GeometryControl
              field={field}
              key={keyName}
              keyName={keyName}
              onFieldChange={onFieldChange}
              onFieldInteractionEnd={onFieldInteractionEnd}
              onFieldInteractionStart={onFieldInteractionStart}
            />
          ))}
        </div>
      </fieldset>

      <fieldset
        className="flex flex-col gap-2.5 border-t pt-3"
        data-geometry-group="size"
      >
        <legend className="font-medium text-sm">Tamanho</legend>
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          {(["width", "height"] as const).map((keyName) => (
            <GeometryControl
              field={field}
              key={keyName}
              keyName={keyName}
              onFieldChange={onFieldChange}
              onFieldInteractionEnd={onFieldInteractionEnd}
              onFieldInteractionStart={onFieldInteractionStart}
            />
          ))}
        </div>
      </fieldset>

      {showTypography ? (
        <fieldset className="flex flex-col gap-2.5 border-t pt-3">
          <legend className="font-medium text-sm">Aparência</legend>
          <div className="grid min-w-0 gap-2.5">
            <InlinePropertyRow
              htmlFor={`${field.field}-font-size`}
              label="Tamanho da fonte"
            >
              <NumericDraftInput
                className="h-10 text-base lg:h-7 lg:text-xs"
                id={`${field.field}-font-size`}
                max={72}
                min={6}
                onCommit={(value) =>
                  onFieldChange(field.field, "fontSize", value)
                }
                onInteractionEnd={onFieldInteractionEnd}
                onInteractionStart={onFieldInteractionStart}
                step={1}
                value={field.fontSize}
              />
            </InlinePropertyRow>
            <InlinePropertyRow label="Cor">
              <ColorPicker
                className="justify-end"
                id={`${field.field}-color`}
                label={null}
                onChange={(value) => onFieldChange(field.field, "color", value)}
                value={field.color}
              />
            </InlinePropertyRow>
            <AlignmentToggle
              label="Alinhamento horizontal"
              onChange={(value) =>
                onFieldChange(
                  field.field,
                  "align",
                  value as CertificateTemplateField["align"]
                )
              }
              options={[
                {
                  icon: AlignLeftIcon,
                  label: "Alinhar à esquerda",
                  value: "left",
                },
                {
                  icon: AlignHorizontalCenterIcon,
                  label: "Alinhar ao centro",
                  value: "center",
                },
                {
                  icon: AlignRightIcon,
                  label: "Alinhar à direita",
                  value: "right",
                },
              ]}
              value={field.align}
            />
            <AlignmentToggle
              label="Alinhamento vertical"
              onChange={(value) =>
                onFieldChange(
                  field.field,
                  "verticalAlign",
                  value as NonNullable<
                    CertificateTemplateField["verticalAlign"]
                  >
                )
              }
              options={[
                { icon: AlignTopIcon, label: "Alinhar ao topo", value: "top" },
                {
                  icon: AlignVerticalCenterIcon,
                  label: "Alinhar ao centro",
                  value: "middle",
                },
                {
                  icon: AlignBottomIcon,
                  label: "Alinhar à base",
                  value: "bottom",
                },
              ]}
              value={field.verticalAlign ?? "middle"}
            />
            <InlinePropertyRow htmlFor={`${field.field}-font`} label="Fonte">
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
                <SelectTrigger id={`${field.field}-font`} size="sm">
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
            </InlinePropertyRow>
          </div>
        </fieldset>
      ) : null}
    </div>
  );
};

const CertificateTemplateBackgroundInspector = ({
  backgroundFile,
  backgroundImageName,
  backgroundPreviewUrl,
  formId,
  onBackgroundFileSelect,
}: Pick<
  CertificateTemplateFieldsProps,
  | "backgroundFile"
  | "backgroundImageName"
  | "backgroundPreviewUrl"
  | "formId"
  | "onBackgroundFileSelect"
>): React.JSX.Element => (
  <section
    aria-labelledby="certificate-document-properties"
    className="flex min-w-0 flex-col gap-3"
    data-document-properties="true"
  >
    <div className="border-b pb-3">
      <h4
        className="font-semibold text-sm"
        id="certificate-document-properties"
      >
        Arte de fundo
      </h4>
      <p className="mt-1 text-muted-foreground text-xs">
        Imagem base do certificado A4 horizontal.
      </p>
    </div>
    <CertificateImageUploadField
      compact
      compactWhenImage
      form={formId}
      id="certificate-background"
      imageName={backgroundImageName}
      imageUrl={backgroundPreviewUrl}
      kind="background"
      label="Adicionar arte A4"
      onFileSelect={onBackgroundFileSelect}
      required={!backgroundPreviewUrl}
      selectedFile={backgroundFile}
    />
  </section>
);

export const CertificateTemplateFields = memo(
  function CertificateTemplateFields({
    backgroundFile,
    backgroundImageName,
    backgroundPreviewUrl,
    backgroundSelected,
    fields,
    formId,
    onFieldChange,
    onFieldInteractionEnd,
    onFieldInteractionStart,
    onFieldSelect,
    onBackgroundFileSelect,
    onSignatureFileSelect,
    onSignerNameChange,
    onSignerRoleChange,
    selectedField,
    signatureFile,
    signatureImageName,
    signaturePreviewUrl,
    signerName,
    signerRole,
  }: CertificateTemplateFieldsProps): React.JSX.Element {
    const selected = fields.find((field) => field.field === selectedField);
    let inspector: React.JSX.Element;
    if (selected) {
      inspector = (
        <CertificateFieldInspector
          field={selected}
          formId={formId}
          onFieldChange={onFieldChange}
          onFieldInteractionEnd={onFieldInteractionEnd}
          onFieldInteractionStart={onFieldInteractionStart}
          onFieldSelect={(field) => onFieldSelect(field)}
          onSignatureFileSelect={onSignatureFileSelect}
          onSignerNameChange={onSignerNameChange}
          onSignerRoleChange={onSignerRoleChange}
          signatureFile={signatureFile}
          signatureImageName={signatureImageName}
          signaturePreviewUrl={signaturePreviewUrl}
          signerName={signerName}
          signerRole={signerRole}
        />
      );
    } else if (backgroundSelected) {
      inspector = (
        <CertificateTemplateBackgroundInspector
          backgroundFile={backgroundFile}
          backgroundImageName={backgroundImageName}
          backgroundPreviewUrl={backgroundPreviewUrl}
          formId={formId}
          onBackgroundFileSelect={onBackgroundFileSelect}
        />
      );
    } else {
      inspector = (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground text-sm">
          Selecione um campo no preview ou em Campos. Clique na arte para editar
          o fundo.
        </p>
      );
    }

    return (
      <section className="flex min-w-0 flex-col gap-5">
        {backgroundSelected ? null : (
          <div className="hidden">
            <CertificateImageUploadField
              form={formId}
              id="certificate-background"
              imageUrl={backgroundPreviewUrl}
              kind="background"
              onFileSelect={onBackgroundFileSelect}
              required={!backgroundPreviewUrl}
              selectedFile={backgroundFile}
            />
          </div>
        )}
        {selectedField === "signerName" ? null : (
          <input
            form={formId}
            name="signerName"
            type="hidden"
            value={signerName}
          />
        )}
        {selectedField === "signerRole" ? null : (
          <input
            form={formId}
            name="signerRole"
            type="hidden"
            value={signerRole}
          />
        )}
        {inspector}
      </section>
    );
  }
);
