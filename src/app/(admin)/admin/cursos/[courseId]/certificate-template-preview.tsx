"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CertificateField,
  CertificateTemplateField,
} from "@/features/certificates/template-rules";
import { cn } from "@/lib/utils";
import { certificateTemplateFieldLabels } from "./certificate-template-field-labels";
import {
  type CertificateFieldGeometry,
  clampCertificateFieldPosition,
  fitCertificateFieldToContent,
  moveCertificateFieldByPixels,
  resizeCertificateFieldByPixels,
  snapCertificateFieldPosition,
} from "./certificate-template-geometry";
import {
  getCertificatePreviewFrame,
  getCertificatePreviewTextStyle,
} from "./certificate-template-preview-layout";

const samples = {
  long: {
    completedAt: "22 de julho de 2026",
    courseTitle: "Especialização em Técnicas Avançadas de Harmonização Facial",
    issuedAt: "22 de julho de 2026",
    issuerCnpj: "12.345.678/0001-90",
    issuerName: "Instituto Protea Educação Profissional",
    signerName: "Dra. Maria Fernanda de Albuquerque",
    signerRole: "Responsável técnica",
    studentName: "Ana Carolina de Souza e Silva",
    validationCode: "PRT-12345678",
    workloadHours: "120 horas",
  },
  short: {
    completedAt: "22/07/2026",
    courseTitle: "Botox",
    issuedAt: "22/07/2026",
    issuerCnpj: "12.345.678/0001-90",
    issuerName: "Protea",
    signerName: "Dra. Ana",
    signerRole: "Especialista",
    studentName: "Ana",
    validationCode: "PRT-123",
    workloadHours: "8 horas",
  },
} as const;

interface CertificateFieldDirection {
  x: number;
  y: number;
}

const getCertificateFieldDirection = (
  key: string
): CertificateFieldDirection | null => {
  const direction = {
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
  }[key];
  return direction ?? null;
};

const resizeFieldFromKeyboard = (
  field: CertificateFieldGeometry,
  direction: CertificateFieldDirection,
  step: number,
  onGeometryChange: ((geometry: CertificateFieldGeometry) => void) | undefined
): boolean => {
  if (!onGeometryChange) {
    return false;
  }
  const next = resizeCertificateFieldByPixels(
    field,
    { x: direction.x * step, y: direction.y * step },
    { height: 100, width: 100 }
  );
  const changed = next.width !== field.width || next.height !== field.height;
  if (changed) {
    onGeometryChange(next);
  }
  return changed;
};

const moveFieldFromKeyboard = (
  field: CertificateFieldGeometry,
  direction: CertificateFieldDirection,
  step: number,
  onPositionChange:
    | ((position: Pick<CertificateFieldGeometry, "x" | "y">) => void)
    | undefined
): boolean => {
  if (!onPositionChange) {
    return false;
  }
  const next = clampCertificateFieldPosition(field, {
    x: field.x + direction.x * step,
    y: field.y + direction.y * step,
  });
  const changed = next.x !== field.x || next.y !== field.y;
  if (changed) {
    onPositionChange({ x: next.x, y: next.y });
  }
  return changed;
};

const handleCertificateFieldKeyDown = (
  event: React.KeyboardEvent<HTMLButtonElement>,
  field: CertificateFieldGeometry,
  hasActiveDrag: boolean,
  cancelDrag: () => void,
  onInteractionEnd: ((committed: boolean) => void) | undefined,
  onInteractionStart: (() => void) | undefined,
  onGeometryChange: ((geometry: CertificateFieldGeometry) => void) | undefined,
  onPositionChange:
    | ((position: Pick<CertificateFieldGeometry, "x" | "y">) => void)
    | undefined
): void => {
  if (event.key === "Escape") {
    if (hasActiveDrag) {
      event.preventDefault();
      cancelDrag();
    }
    return;
  }
  const direction = getCertificateFieldDirection(event.key);
  if (!direction) {
    return;
  }
  event.preventDefault();
  onInteractionStart?.();
  const step = event.shiftKey ? 5 : 0.5;
  const changed = event.altKey
    ? resizeFieldFromKeyboard(field, direction, step, onGeometryChange)
    : moveFieldFromKeyboard(field, direction, step, onPositionChange);
  onInteractionEnd?.(changed);
};

const measureTextContent = (
  element: HTMLElement
): { height: number; width: number } => {
  const child = element.firstElementChild as HTMLElement | null;
  const original = {
    display: element.style.display,
    height: element.style.height,
    maxWidth: element.style.maxWidth,
    whiteSpace: element.style.whiteSpace,
    width: element.style.width,
  };
  const originalChildWidth = child?.style.width ?? "";

  element.style.display = "block";
  element.style.height = "auto";
  element.style.maxWidth = "none";
  element.style.whiteSpace = "nowrap";
  element.style.width = "max-content";
  if (child) {
    child.style.width = "auto";
  }

  const rect = element.getBoundingClientRect();
  const size = {
    height: Math.max(rect.height, element.scrollHeight),
    width: Math.max(rect.width, element.scrollWidth),
  };

  element.style.display = original.display;
  element.style.height = original.height;
  element.style.maxWidth = original.maxWidth;
  element.style.whiteSpace = original.whiteSpace;
  element.style.width = original.width;
  if (child) {
    child.style.width = originalChildWidth;
  }

  return size;
};

export function CertificateTemplatePreview({
  backgroundUrl,
  courseWorkloadHours,
  fields,
  fitContentRequest,
  onFieldGeometryChange,
  onFieldInteractionEnd,
  onFieldInteractionStart,
  onFieldPositionChange,
  onFieldSelect,
  onBackgroundSelect,
  onOverflowFieldsChange,
  overlapFields,
  signatureUrl,
  signerName,
  signerRole,
  selectedField,
  backgroundSelected,
  variant,
}: {
  backgroundUrl: string | null;
  courseWorkloadHours?: number;
  fields: CertificateTemplateField[];
  fitContentRequest?: {
    field: CertificateField;
    id: number;
  } | null;
  onFieldGeometryChange?: (
    field: CertificateTemplateField["field"],
    geometry: CertificateFieldGeometry
  ) => void;
  onFieldInteractionEnd?: (committed: boolean) => void;
  onFieldInteractionStart?: () => void;
  onFieldPositionChange?: (
    field: CertificateTemplateField["field"],
    position: Pick<CertificateFieldGeometry, "x" | "y">
  ) => void;
  onFieldSelect?: (field: CertificateTemplateField["field"] | null) => void;
  onBackgroundSelect?: () => void;
  onOverflowFieldsChange?: (fields: CertificateField[]) => void;
  overlapFields: ReadonlySet<CertificateTemplateField["field"]>;
  signatureUrl: string | null;
  signerName: string;
  signerRole: string;
  selectedField?: CertificateTemplateField["field"] | null;
  backgroundSelected?: boolean;
  variant: "long" | "short";
}): React.JSX.Element {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [renderedWidth, setRenderedWidth] = useState(0);
  const overflowFieldsRef = useRef<Set<CertificateTemplateField["field"]>>(
    new Set()
  );
  const pageRef = useRef<HTMLDivElement>(null);
  const values = useMemo(
    () => ({
      ...samples[variant],
      workloadHours:
        courseWorkloadHours === undefined
          ? samples[variant].workloadHours
          : `${courseWorkloadHours} horas`,
      signerName: signerName.trim() || samples[variant].signerName,
      signerRole: signerRole.trim() || samples[variant].signerRole,
    }),
    [courseWorkloadHours, signerName, signerRole, variant]
  );

  useEffect(() => {
    QRCode.toDataURL("https://hub.example.test/certificados/PRT-12345678", {
      margin: 1,
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, []);

  useEffect(() => {
    const page = pageRef.current;
    if (!page || renderedWidth <= 0) {
      return;
    }

    const nextOverflowFields = new Set<CertificateTemplateField["field"]>();
    for (const element of page.querySelectorAll<HTMLElement>(
      "[data-preview-text-field]"
    )) {
      const field = element.dataset.previewTextField as
        | CertificateTemplateField["field"]
        | undefined;
      const isVisible = field
        ? fields.some((item) => item.field === field && item.visible)
        : false;
      const value = field
        ? (values as Record<string, string>)[field]
        : undefined;
      if (
        field &&
        isVisible &&
        value &&
        (element.scrollHeight > element.clientHeight + 1 ||
          element.scrollWidth > element.clientWidth + 1)
      ) {
        nextOverflowFields.add(field);
      }
    }

    const currentOverflowFields = overflowFieldsRef.current;
    if (
      currentOverflowFields.size === nextOverflowFields.size &&
      [...currentOverflowFields].every((field) => nextOverflowFields.has(field))
    ) {
      return;
    }
    overflowFieldsRef.current = nextOverflowFields;
    onOverflowFieldsChange?.([...nextOverflowFields]);
  }, [fields, onOverflowFieldsChange, renderedWidth, values]);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) {
      return;
    }
    const updateWidth = (): void => setRenderedWidth(page.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(page);
    return () => observer.disconnect();
  }, []);

  const lastFitRequestIdRef = useRef(0);
  useEffect(() => {
    const request = fitContentRequest;
    if (!request || request.id <= lastFitRequestIdRef.current) {
      return;
    }

    const page = pageRef.current;
    const field = fields.find((item) => item.field === request.field);
    if (
      !(page && field) ||
      field.field === "qrCode" ||
      field.field === "signatureImage"
    ) {
      lastFitRequestIdRef.current = request.id;
      return;
    }

    const element = page.querySelector<HTMLElement>(
      `[data-preview-text-field="${field.field}"]`
    );
    const pageRect = page.getBoundingClientRect();
    if (!element || pageRect.width <= 0 || pageRect.height <= 0) {
      return;
    }

    const contentSize = measureTextContent(element);
    if (contentSize.width <= 0 || contentSize.height <= 0) {
      return;
    }

    const nextGeometry = fitCertificateFieldToContent(field, contentSize, {
      height: pageRect.height,
      width: pageRect.width,
    });
    lastFitRequestIdRef.current = request.id;
    if (
      nextGeometry.width === field.width &&
      nextGeometry.height === field.height &&
      nextGeometry.x === field.x &&
      nextGeometry.y === field.y
    ) {
      return;
    }

    onFieldInteractionStart?.();
    onFieldGeometryChange?.(field.field, nextGeometry);
    onFieldInteractionEnd?.(true);
  }, [
    fields,
    fitContentRequest,
    onFieldGeometryChange,
    onFieldInteractionEnd,
    onFieldInteractionStart,
  ]);

  const visibleFields = useMemo(
    () => fields.filter((field) => field.visible),
    [fields]
  );
  const overflowFieldLabels = [...overflowFieldsRef.current].map(
    (field) => certificateTemplateFieldLabels[field]
  );
  const dragRef = useRef<{
    field: CertificateTemplateField["field"];
    moved: boolean;
    mode: "move" | "resize";
    preserveAspectRatio: boolean;
    pointerId: number;
    startField: CertificateFieldGeometry;
    startPointer: { x: number; y: number };
  } | null>(null);
  const [draggingField, setDraggingField] = useState<
    CertificateTemplateField["field"] | null
  >(null);
  const [dragMode, setDragMode] = useState<"move" | "resize" | null>(null);
  const [snapGuides, setSnapGuides] = useState({
    horizontal: false,
    vertical: false,
  });

  const endDrag = (committed: boolean): void => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    dragRef.current = null;
    setDraggingField(null);
    setDragMode(null);
    setSnapGuides({ horizontal: false, vertical: false });
    onFieldInteractionEnd?.(committed && drag.moved);
  };

  return (
    <div className="relative aspect-[1.414/1] w-full min-w-0 overflow-hidden overscroll-contain bg-muted/20">
      <div
        className="relative mx-auto shrink-0 overflow-hidden bg-background"
        data-certificate-page="true"
        ref={pageRef}
        style={{
          aspectRatio: "1.414 / 1",
          width: "100%",
        }}
      >
        {backgroundUrl ? (
          <Image
            alt="Arte do certificado"
            className="pointer-events-none object-cover"
            fill
            sizes="(min-width: 1024px) 60vw, 100vw"
            src={backgroundUrl}
            unoptimized
          />
        ) : null}
        {onBackgroundSelect ? (
          <button
            aria-label="Selecionar arte de fundo"
            aria-pressed={backgroundSelected}
            className={cn(
              "absolute inset-0 z-0 border border-transparent outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              backgroundSelected &&
                "border-primary/70 ring-2 ring-primary/70 ring-offset-1"
            )}
            data-editor-background="true"
            onClick={onBackgroundSelect}
            type="button"
          />
        ) : null}
        {visibleFields.map((field) => {
          const frame = getCertificatePreviewFrame(field);
          const hasOverlap = overlapFields.has(field.field);
          const overlapClassName = hasOverlap
            ? "bg-amber-400/10 ring-2 ring-amber-500 ring-offset-1 ring-offset-background"
            : "";
          const overlapMarker = hasOverlap ? "true" : undefined;
          if (field.field === "qrCode") {
            return qrDataUrl ? (
              <Image
                alt="Código QR de validação"
                className={cn("pointer-events-none absolute", overlapClassName)}
                data-overlap={overlapMarker}
                height={128}
                key={field.field}
                src={qrDataUrl}
                style={frame}
                unoptimized
                width={128}
              />
            ) : null;
          }
          if (field.field === "signatureImage") {
            return signatureUrl ? (
              <Image
                alt="Assinatura visual"
                className={cn(
                  "pointer-events-none absolute object-contain",
                  overlapClassName
                )}
                data-overlap={overlapMarker}
                height={128}
                key={field.field}
                src={signatureUrl}
                style={frame}
                unoptimized
                width={128}
              />
            ) : null;
          }
          const value = values[field.field];
          return (
            <p
              className={cn(
                "pointer-events-none absolute overflow-hidden text-pretty break-words",
                overlapClassName
              )}
              data-overlap={overlapMarker}
              data-preview-text-field={field.field}
              key={field.field}
              style={getCertificatePreviewTextStyle(field, renderedWidth)}
            >
              <span className="block w-full">{value}</span>
            </p>
          );
        })}
        {visibleFields.map((field, index) => {
          const isDragging = draggingField === field.field;
          const isSelected = selectedField === field.field;
          const frame = getCertificatePreviewFrame(field);

          return (
            <button
              aria-label={`Selecionar ${certificateTemplateFieldLabels[field.field]}`}
              aria-pressed={isSelected}
              className={cn(
                "absolute cursor-move touch-none select-none rounded-sm border border-transparent bg-transparent p-0 outline-none transition-[box-shadow,border-color] after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:size-2 after:rounded-sm after:bg-primary after:opacity-0 after:transition-opacity focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                isSelected &&
                  "border-primary ring-2 ring-primary ring-offset-1 after:opacity-100",
                isDragging &&
                  (dragMode === "resize"
                    ? "cursor-se-resize"
                    : "cursor-grabbing")
              )}
              data-editor-field={field.field}
              key={`editor-${field.field}`}
              onClick={() => onFieldSelect?.(field.field)}
              onKeyDown={(event) =>
                handleCertificateFieldKeyDown(
                  event,
                  field,
                  Boolean(dragRef.current),
                  () => endDrag(false),
                  onFieldInteractionEnd,
                  onFieldInteractionStart,
                  onFieldGeometryChange
                    ? (geometry) => onFieldGeometryChange(field.field, geometry)
                    : undefined,
                  onFieldPositionChange
                    ? (position) => onFieldPositionChange(field.field, position)
                    : undefined
                )
              }
              onPointerCancel={() => endDrag(false)}
              onPointerDown={(event) => {
                if (event.button !== 0 || !pageRef.current) {
                  return;
                }
                event.preventDefault();
                event.currentTarget.focus();
                onFieldSelect?.(field.field);
                const pageRect = pageRef.current.getBoundingClientRect();
                const fieldRect = event.currentTarget.getBoundingClientRect();
                const isResize =
                  isSelected &&
                  fieldRect.width >= 16 &&
                  fieldRect.height >= 16 &&
                  event.clientX >= fieldRect.right - 16 &&
                  event.clientY >= fieldRect.bottom - 16;
                dragRef.current = {
                  field: field.field,
                  moved: false,
                  mode: isResize ? "resize" : "move",
                  pointerId: event.pointerId,
                  preserveAspectRatio: event.shiftKey,
                  startField: {
                    height: field.height,
                    width: field.width,
                    x: field.x,
                    y: field.y,
                  },
                  startPointer: { x: event.clientX, y: event.clientY },
                };
                setDraggingField(field.field);
                setDragMode(isResize ? "resize" : "move");
                setSnapGuides({ horizontal: false, vertical: false });
                onFieldInteractionStart?.();
                if (
                  typeof event.currentTarget.setPointerCapture === "function"
                ) {
                  event.currentTarget.setPointerCapture(event.pointerId);
                }
                if (pageRect.width <= 0 || pageRect.height <= 0) {
                  endDrag(false);
                }
              }}
              onPointerMove={(event) => {
                const drag = dragRef.current;
                if (
                  !drag ||
                  drag.pointerId !== event.pointerId ||
                  !pageRef.current ||
                  !(onFieldPositionChange || onFieldGeometryChange)
                ) {
                  return;
                }
                const pageRect = pageRef.current.getBoundingClientRect();
                const delta = {
                  x: event.clientX - drag.startPointer.x,
                  y: event.clientY - drag.startPointer.y,
                };
                if (Math.max(Math.abs(delta.x), Math.abs(delta.y)) < 3) {
                  return;
                }
                drag.moved = true;
                if (drag.mode === "resize") {
                  if (!onFieldGeometryChange) {
                    return;
                  }
                  const next = resizeCertificateFieldByPixels(
                    drag.startField,
                    delta,
                    { height: pageRect.height, width: pageRect.width },
                    {
                      anchor: "center",
                      preserveAspectRatio:
                        drag.preserveAspectRatio || event.shiftKey,
                    }
                  );
                  setSnapGuides({ horizontal: false, vertical: false });
                  onFieldGeometryChange(field.field, next);
                  return;
                }
                if (!onFieldPositionChange) {
                  return;
                }
                const moved = moveCertificateFieldByPixels(
                  drag.startField,
                  delta,
                  { height: pageRect.height, width: pageRect.width }
                );
                const next = snapCertificateFieldPosition(
                  drag.startField,
                  moved
                );
                setSnapGuides({
                  horizontal: next.y !== moved.y,
                  vertical: next.x !== moved.x,
                });
                onFieldPositionChange(field.field, {
                  x: next.x,
                  y: next.y,
                });
              }}
              onPointerUp={() => endDrag(true)}
              style={{
                ...frame,
                zIndex: 20 + index,
              }}
              type="button"
            >
              {isSelected ? (
                <span
                  className={cn(
                    "pointer-events-none absolute left-0 z-10 max-w-full truncate rounded bg-primary px-1.5 py-0.5 font-medium text-primary-foreground text-xs",
                    "-top-6"
                  )}
                  data-selected-label-placement="above"
                >
                  {certificateTemplateFieldLabels[field.field]}
                </span>
              ) : null}
            </button>
          );
        })}
        {draggingField && snapGuides.vertical ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-1/2 z-30 w-px bg-primary/60"
            data-snap-guide="vertical"
          />
        ) : null}
        {draggingField && snapGuides.horizontal ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-1/2 z-30 h-px bg-primary/60"
            data-snap-guide="horizontal"
          />
        ) : null}
      </div>
      {overflowFieldLabels.length > 0 ? (
        <p
          aria-live="polite"
          className="pointer-events-none absolute right-2 bottom-2 left-2 rounded-md bg-accent/90 px-2 py-1 text-center font-medium text-accent-foreground text-xs"
          role="status"
        >
          Texto fora da área: {overflowFieldLabels.join(", ")}. O PDF manterá o
          recorte configurado.
        </p>
      ) : null}
    </div>
  );
}
