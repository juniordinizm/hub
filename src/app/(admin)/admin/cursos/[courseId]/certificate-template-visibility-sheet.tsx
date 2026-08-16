"use client";

import { GridViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
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
import { isRequiredCertificateField } from "@/features/certificates/template-rules";
import { certificateTemplateFieldLabels } from "./certificate-template-field-labels";
import {
  certificateFieldGroups,
  getCertificateFieldMetadata,
} from "./certificate-template-field-metadata";

const sourceLabels = {
  course: "Curso",
  emission: "Emissão",
  issuer: "Emissor",
  validation: "Validação",
} as const;

export function CertificateTemplateVisibilitySheet({
  compact = false,
  fields,
  onFieldChange,
  onFieldSelect,
  overlapFields,
}: {
  compact?: boolean;
  fields: CertificateTemplateField[];
  onFieldChange: (field: CertificateField, visible: boolean) => void;
  onFieldSelect: (field: CertificateField) => void;
  overlapFields: ReadonlySet<CertificateField>;
}): React.JSX.Element {
  const visibleCount = fields.filter((field) => field.visible).length;
  const triggerButton = (
    <Button
      aria-label={`Campos visíveis: ${visibleCount} de ${fields.length}`}
      data-visibility-trigger="true"
      size={compact ? "icon-xs" : "xs"}
      type="button"
      variant={compact ? "ghost" : "outline"}
    >
      {compact ? (
        <>
          <HugeiconsIcon icon={GridViewIcon} />
          <span className="sr-only">
            Campos {visibleCount}/{fields.length}
          </span>
        </>
      ) : (
        <>
          Campos{" "}
          <span className="text-muted-foreground tabular-nums">
            {visibleCount}/{fields.length}
          </span>
        </>
      )}
    </Button>
  );

  return (
    <Sheet>
      {compact ? (
        <TooltipProvider delayDuration={250}>
          <Tooltip>
            <TooltipTrigger asChild>
              <SheetTrigger asChild>{triggerButton}</SheetTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Gerenciar campos e visibilidade
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <SheetTrigger asChild>{triggerButton}</SheetTrigger>
      )}
      <SheetContent className="w-[min(90vw,24rem)] sm:max-w-sm" side="right">
        <SheetHeader className="border-b px-4 py-4 pr-14">
          <SheetTitle>Campos e visibilidade</SheetTitle>
          <SheetDescription>
            Escolha um campo para editar suas propriedades. Campos ocultos ficam
            preservados no template.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <div className="flex flex-col gap-5">
            {certificateFieldGroups.map((group) => {
              const groupFields = group.fields
                .map((fieldName) =>
                  fields.find((field) => field.field === fieldName)
                )
                .filter(
                  (field): field is CertificateTemplateField =>
                    field !== undefined
                );

              if (groupFields.length === 0) {
                return null;
              }

              return (
                <section
                  aria-labelledby={`visibility-${group.id}`}
                  key={group.id}
                >
                  <div className="mb-2">
                    <h3
                      className="font-medium text-sm"
                      id={`visibility-${group.id}`}
                    >
                      {group.label}
                    </h3>
                    <p className="mt-0.5 text-muted-foreground text-xs">
                      {group.description}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {groupFields.map((field) => {
                      const label = certificateTemplateFieldLabels[field.field];
                      const metadata = getCertificateFieldMetadata(field.field);
                      const hasOverlap = overlapFields.has(field.field);
                      const isRequired = isRequiredCertificateField(
                        field.field
                      );
                      let diagnostic: string = sourceLabels[metadata.source];
                      if (hasOverlap) {
                        diagnostic = "Ajustar";
                      }
                      if (isRequired) {
                        diagnostic = "Obrigatório";
                      }

                      return (
                        <div
                          className="flex items-center gap-2 rounded-lg border border-transparent p-1.5 transition-colors hover:border-border hover:bg-muted/50"
                          data-field-row={field.field}
                          key={field.field}
                        >
                          <SheetClose asChild>
                            <Button
                              aria-label={`Editar ${label}`}
                              className="min-w-0 flex-1 justify-start gap-2 px-2 text-left"
                              onClick={() => onFieldSelect(field.field)}
                              type="button"
                              variant="ghost"
                            >
                              <span className="min-w-0 flex-1 truncate">
                                {label}
                              </span>
                              <span
                                className={
                                  hasOverlap
                                    ? "shrink-0 text-amber-500 text-xs"
                                    : "shrink-0 text-muted-foreground text-xs"
                                }
                              >
                                {diagnostic}
                              </span>
                            </Button>
                          </SheetClose>
                          <Switch
                            aria-label={
                              isRequired && field.visible
                                ? `${label} é obrigatório e permanece visível`
                                : `${field.visible ? "Ocultar" : "Exibir"} ${label}`
                            }
                            checked={field.visible}
                            disabled={isRequired && field.visible}
                            onCheckedChange={(checked) =>
                              onFieldChange(field.field, checked)
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
