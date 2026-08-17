"use client";

import {
  AlignHorizontalCenterIcon,
  AlignVerticalCenterIcon,
  FitToScreenIcon,
  Undo02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  publishCertificateTemplateFormAction,
  saveCertificateTemplateDraftFormAction,
} from "@/features/admin/actions";
import {
  type CertificateTemplateActionState,
  certificateTemplateInitialActionState,
} from "@/features/admin/certificate-template-action-state";
import { CertificateTemplateCropDialog } from "@/features/certificates/template-crop-dialog";
import {
  type CertificateField,
  type CertificateTemplateField,
  type CertificateTemplateSpec,
  createDefaultCertificateTemplateFields,
  ensureCertificateTemplateFields,
  findCertificateTemplateOverlaps,
} from "@/features/certificates/template-rules";
import type { StagedAdminImageReference } from "@/features/storage/staged-image-upload";
import { uploadStagedAdminImage } from "@/features/storage/staged-image-upload-client";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useOwnedObjectUrl } from "@/hooks/use-owned-object-url";
import { certificateTemplateFieldLabels } from "./certificate-template-field-labels";
import {
  type CertificateFieldChange,
  CertificateTemplateFields,
} from "./certificate-template-fields";
import { applyCertificateTemplateUploads } from "./certificate-template-form-data";
import { resizeCertificateFieldGeometry } from "./certificate-template-geometry";
import { CertificateTemplateOverlapNotice } from "./certificate-template-overlap-notice";
import { CertificateTemplatePreview } from "./certificate-template-preview";
import { CertificateTemplateVisibilitySheet } from "./certificate-template-visibility-sheet";

const CERTIFICATE_TEMPLATE_FORM_ID = "certificate-template-editor-form";

interface CertificateTemplateEditorStatus {
  label: string;
  tone: "default" | "outline" | "secondary";
}

const isFittableCertificateField = (
  field: CertificateField | null,
  config: CertificateTemplateField | undefined
): boolean =>
  Boolean(config?.visible && field !== "qrCode" && field !== "signatureImage");

const getCertificateInspectorTitle = (
  backgroundSelected: boolean,
  selectedField: CertificateField | null
): string => {
  if (backgroundSelected) {
    return "Arte de fundo";
  }
  return selectedField
    ? certificateTemplateFieldLabels[selectedField]
    : "Propriedades";
};

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

const getTemplateActionError = (
  saveState: CertificateTemplateActionState,
  publishState: CertificateTemplateActionState,
  lastAction: "save" | "publish" | null
): CertificateTemplateActionState | null => {
  let actionState: CertificateTemplateActionState | null = null;
  if (lastAction === "publish") {
    actionState = publishState;
  } else if (lastAction === "save") {
    actionState = saveState;
  }
  if (actionState?.status !== "error") {
    return null;
  }
  return actionState;
};

const TemplateFormNotices = ({
  hasPublishedTemplate,
  lastAction,
  issuerConfigured,
  publishState,
  saveState,
}: {
  hasPublishedTemplate: boolean;
  lastAction: "save" | "publish" | null;
  issuerConfigured: boolean;
  publishState: CertificateTemplateActionState;
  saveState: CertificateTemplateActionState;
}): React.JSX.Element => {
  const actionError = getTemplateActionError(
    saveState,
    publishState,
    lastAction
  );

  return (
    <>
      {hasPublishedTemplate ? null : (
        <p className="text-muted-foreground text-xs">
          Publique um template para ativar o certificado neste curso.
        </p>
      )}
      {issuerConfigured ? null : (
        <Alert variant="destructive">
          <AlertTitle>Perfil emissor pendente</AlertTitle>
          <AlertDescription>
            Cadastre razão social, nome de marca e CNPJ em Configurações antes
            de publicar.
          </AlertDescription>
        </Alert>
      )}
      {actionError ? (
        <Alert variant="destructive">
          <AlertTitle>
            {lastAction === "publish"
              ? "Certificado não publicado"
              : "Rascunho não salvo"}
          </AlertTitle>
          <AlertDescription>{actionError.message}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
};

const PreviewToolbarTooltip = ({
  children,
  label,
}: {
  children: React.ReactElement;
  label: string;
}): React.JSX.Element => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side="bottom" sideOffset={6}>
      {label}
    </TooltipContent>
  </Tooltip>
);

const TemplateVersionBadges = ({
  template,
}: {
  template: CertificateTemplateEditorTemplate | undefined;
}): React.JSX.Element => (
  <span className="text-muted-foreground text-xs">
    {template ? <>Versão {template.version}</> : "Nova arte"}
  </span>
);

interface CertificateTemplateSessionHeaderProps {
  backgroundPreviewUrl: string | null;
  children?: React.ReactNode;
  hasPublishableChanges: boolean;
  isBusy: boolean;
  isDirty: boolean;
  isPublishing: boolean;
  isSaving: boolean;
  issuerConfigured: boolean;
  onPublish: (formData: FormData) => void;
  status: CertificateTemplateEditorStatus;
  template: CertificateTemplateEditorTemplate | undefined;
}

const CertificateTemplateSessionHeader = ({
  backgroundPreviewUrl,
  children,
  hasPublishableChanges,
  isBusy,
  isDirty,
  isPublishing,
  isSaving,
  issuerConfigured,
  onPublish,
  status,
  template,
}: CertificateTemplateSessionHeaderProps): React.JSX.Element => (
  <CardHeader
    className="flex flex-col gap-2 border-b sm:flex-row sm:items-center sm:justify-between"
    density="compact"
  >
    <div className="flex min-w-0 items-center gap-2">
      <CardTitle as="h2" className="text-sm">
        Certificado
      </CardTitle>
      <Badge variant={isDirty ? "outline" : status.tone}>
        {isDirty ? "Alterações não salvas" : status.label}
      </Badge>
      <TemplateVersionBadges template={template} />
    </div>
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        aria-busy={isSaving}
        disabled={!isDirty || isBusy}
        form={CERTIFICATE_TEMPLATE_FORM_ID}
        name="intent"
        size="sm"
        type="submit"
        value="save"
        variant="secondary"
      >
        {isSaving ? "Salvando…" : "Salvar rascunho"}
      </Button>
      <Button
        aria-busy={isPublishing}
        disabled={
          !(
            issuerConfigured &&
            backgroundPreviewUrl &&
            hasPublishableChanges
          ) || isBusy
        }
        form={CERTIFICATE_TEMPLATE_FORM_ID}
        formAction={onPublish}
        size="sm"
        type="submit"
        variant="default"
      >
        {isPublishing ? "Publicando…" : "Salvar e publicar"}
      </Button>
      {children}
    </div>
  </CardHeader>
);

const NoPublishableChangesHint = ({
  hasPublishableChanges,
}: {
  hasPublishableChanges: boolean;
}): React.JSX.Element | null => {
  if (hasPublishableChanges) {
    return null;
  }
  return (
    <p
      aria-live="polite"
      className="mt-3 text-center text-muted-foreground text-xs"
    >
      Altere o template ou crie um rascunho para publicar uma nova versão.
    </p>
  );
};

const CertificateTemplateInspector = ({
  children,
  disabled,
  hasPublishableChanges,
  overlaps,
  templateFieldError,
}: {
  children: React.ReactNode;
  disabled: boolean;
  hasPublishableChanges: boolean;
  overlaps: ReturnType<typeof findCertificateTemplateOverlaps>;
  templateFieldError: string | undefined;
}): React.JSX.Element => (
  <>
    {overlaps.length > 0 || templateFieldError || !hasPublishableChanges ? (
      <div className="mb-3 space-y-1.5" data-properties-diagnostics="true">
        <CertificateTemplateOverlapNotice overlaps={overlaps} />
        <FieldError>{templateFieldError}</FieldError>
        <NoPublishableChangesHint
          hasPublishableChanges={hasPublishableChanges}
        />
      </div>
    ) : null}
    <fieldset className="flex min-w-0 flex-col gap-3" disabled={disabled}>
      {children}
    </fieldset>
  </>
);

const selectBackgroundFile = ({
  file,
  setBackgroundFile,
  setBackgroundRemoved,
  setCropSource,
  setIsDirty,
}: {
  file: File | null;
  setBackgroundFile: (file: File | null) => void;
  setBackgroundRemoved: (removed: boolean) => void;
  setCropSource: (file: File | null) => void;
  setIsDirty: (dirty: boolean) => void;
}): void => {
  if (file) {
    setCropSource(file);
    return;
  }
  setBackgroundFile(null);
  setBackgroundRemoved(true);
  setIsDirty(true);
};

const selectSignatureFile = ({
  file,
  setIsDirty,
  setSignatureFile,
  setSignatureRemoved,
}: {
  file: File | null;
  setIsDirty: (dirty: boolean) => void;
  setSignatureFile: (file: File | null) => void;
  setSignatureRemoved: (removed: boolean) => void;
}): void => {
  setSignatureFile(file);
  setSignatureRemoved(!file);
  setIsDirty(true);
};

const notifyTemplateAction = ({
  onSuccess,
  state,
}: {
  onSuccess: () => void;
  state: CertificateTemplateActionState;
}): void => {
  if (state.status === "idle" || !state.message) {
    return;
  }
  if (state.status === "success") {
    toast.success(state.message);
    onSuccess();
    return;
  }
  toast.error(state.message);
};

export function CertificateTemplateForm({
  children,
  courseId,
  courseWorkloadHours,
  hasPublishedTemplate,
  issuerConfigured,
  status,
  template,
}: {
  children?: React.ReactNode;
  courseId: string;
  courseWorkloadHours: number;
  hasPublishedTemplate: boolean;
  issuerConfigured: boolean;
  status: CertificateTemplateEditorStatus;
  template: CertificateTemplateEditorTemplate | undefined;
}): React.JSX.Element {
  const router = useRouter();
  const isCompact = useMediaQuery("(max-width: 1023px)");
  const backgroundUploadRequestIdRef = useRef(0);
  const signatureUploadRequestIdRef = useRef(0);
  const [fields, setFields] = useState<CertificateTemplateField[]>(() =>
    template?.spec.fields
      ? ensureCertificateTemplateFields(template.spec.fields)
      : createDefaultCertificateTemplateFields()
  );
  const fieldsRef = useRef(fields);
  const [selectedField, setSelectedField] = useState<CertificateField | null>(
    null
  );
  const [backgroundSelected, setBackgroundSelected] = useState(false);
  const [propertiesSheetOpen, setPropertiesSheetOpen] = useState(false);
  const fieldInteractionSnapshotRef = useRef<CertificateTemplateField[] | null>(
    null
  );
  const fieldInteractionDirtyRef = useRef(false);
  const fieldHistoryRef = useRef<CertificateTemplateField[][]>([]);
  const [undoCount, setUndoCount] = useState(0);

  // As imagens padrão
  const defaultBackgroundUrl = template?.backgroundUrl ?? null;
  const defaultSignatureUrl = template?.signatureUrl ?? null;
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundUpload, setBackgroundUpload] =
    useState<StagedAdminImageReference | null>(null);
  const [backgroundRemoved, setBackgroundRemoved] = useState(false);
  const [cropSource, setCropSource] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signatureUpload, setSignatureUpload] =
    useState<StagedAdminImageReference | null>(null);
  const [signatureRemoved, setSignatureRemoved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastAction, setLastAction] = useState<"save" | "publish" | null>(null);
  const [pendingImageUploads, setPendingImageUploads] = useState(0);
  const [signerName, setSignerName] = useState(template?.signerName ?? "");
  const [signerRole, setSignerRole] = useState(template?.signerRole ?? "");
  const backgroundObjectUrl = useOwnedObjectUrl(backgroundFile);
  const signatureObjectUrl = useOwnedObjectUrl(signatureFile);
  const backgroundImageName = template?.spec.backgroundKey?.split("/").at(-1);
  const signatureImageName = template?.signatureKey?.split("/").at(-1);

  // Estado para os URLs das imagens que são mostrados no Preview
  // Se o usuário selecionou um arquivo local, setamos aqui para preview.
  // Se o usuário removeu, setamos para null.
  const backgroundPreviewUrl = backgroundRemoved
    ? null
    : (backgroundObjectUrl ?? defaultBackgroundUrl);
  const signaturePreviewUrl = signatureRemoved
    ? null
    : (signatureObjectUrl ?? defaultSignatureUrl);
  const [previewVariant, setPreviewVariant] = useState<"long" | "short">(
    "short"
  );
  const fitRequestIdRef = useRef(0);
  const [fitContentRequest, setFitContentRequest] = useState<{
    field: CertificateField;
    id: number;
  } | null>(null);

  const selectField = useCallback(
    (field: CertificateField | null): void => {
      setBackgroundSelected(false);
      setSelectedField(field);
      if (field && isCompact) {
        setPropertiesSheetOpen(true);
      }
    },
    [isCompact]
  );
  const selectBackground = useCallback((): void => {
    setSelectedField(null);
    setBackgroundSelected(true);
    if (isCompact) {
      setPropertiesSheetOpen(true);
    }
  }, [isCompact]);

  const [saveState, saveAction, isSaving] = useActionState(
    saveCertificateTemplateDraftFormAction,
    certificateTemplateInitialActionState
  );
  const [publishState, publishAction, isPublishing] = useActionState(
    publishCertificateTemplateFormAction,
    certificateTemplateInitialActionState
  );
  const prepareSubmission = (formData: FormData): void =>
    applyCertificateTemplateUploads(formData, {
      background: backgroundUpload,
      signature: signatureUpload,
    });
  const saveTemplate = (formData: FormData): void => {
    prepareSubmission(formData);
    setLastAction("save");
    saveAction(formData);
  };
  const publishTemplate = (formData: FormData): void => {
    prepareSubmission(formData);
    setLastAction("publish");
    publishAction(formData);
  };
  const clearFieldHistory = useCallback((): void => {
    fieldHistoryRef.current = [];
    setUndoCount(0);
  }, []);

  const applyFields = useCallback((nextFields: CertificateTemplateField[]) => {
    fieldsRef.current = nextFields;
    setFields(nextFields);
  }, []);

  useEffect(() => {
    notifyTemplateAction({
      onSuccess: () => {
        setBackgroundFile(null);
        setBackgroundUpload(null);
        setSignatureFile(null);
        setSignatureUpload(null);
        setCropSource(null);
        setIsDirty(false);
        clearFieldHistory();
        router.refresh();
      },
      state: saveState,
    });
  }, [clearFieldHistory, router, saveState]);

  useEffect(() => {
    notifyTemplateAction({
      onSuccess: () => {
        setBackgroundFile(null);
        setBackgroundUpload(null);
        setSignatureFile(null);
        setSignatureUpload(null);
        setCropSource(null);
        setIsDirty(false);
        clearFieldHistory();
        router.refresh();
      },
      state: publishState,
    });
  }, [clearFieldHistory, publishState, router]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const spec = useMemo<CertificateTemplateSpec>(
    () => ({
      // Se backgroundPreviewUrl for null, o usuário removeu, então mandamos vazio.
      // Se for válido, mantemos a key atual, o server sobrescreve se um novo arquivo for submetido.
      backgroundKey: backgroundPreviewUrl
        ? (template?.spec.backgroundKey ?? "")
        : "",
      fields,
    }),
    [fields, template?.spec.backgroundKey, backgroundPreviewUrl]
  );
  const overlaps = useMemo(
    () => findCertificateTemplateOverlaps(spec.fields),
    [spec.fields]
  );
  const overlapFields = useMemo(
    () => new Set(overlaps.flatMap(({ fields: fieldPair }) => fieldPair)),
    [overlaps]
  );
  const templateFieldError = getTemplateActionError(
    saveState,
    publishState,
    lastAction
  )?.fieldErrors?.template;

  const updateField = useCallback<CertificateFieldChange>(
    (name, key, value): void => {
      const currentFields = fieldsRef.current;
      const currentField = currentFields.find((field) => field.field === name);
      if (!currentField || Object.is(currentField[key], value)) {
        return;
      }
      if (!fieldInteractionSnapshotRef.current) {
        fieldHistoryRef.current.push(currentFields);
        setUndoCount(fieldHistoryRef.current.length);
      }
      setIsDirty(true);
      applyFields(
        currentFields.map((field) => {
          if (field.field !== name) {
            return field;
          }
          if (
            (key === "width" || key === "height") &&
            typeof value === "number"
          ) {
            return {
              ...field,
              ...resizeCertificateFieldGeometry(field, { [key]: value }),
            };
          }
          return { ...field, [key]: value };
        })
      );
    },
    [applyFields]
  );
  const updateFieldPosition = useCallback(
    (
      name: CertificateField,
      position: Pick<CertificateTemplateField, "x" | "y">
    ): void => {
      const currentFields = fieldsRef.current;
      setIsDirty(true);
      applyFields(
        currentFields.map((field) =>
          field.field === name
            ? { ...field, x: position.x, y: position.y }
            : field
        )
      );
    },
    [applyFields]
  );
  const updateFieldGeometry = useCallback(
    (
      name: CertificateField,
      geometry: Pick<CertificateTemplateField, "height" | "width" | "x" | "y">
    ): void => {
      const currentFields = fieldsRef.current;
      setIsDirty(true);
      applyFields(
        currentFields.map((field) =>
          field.field === name ? { ...field, ...geometry } : field
        )
      );
    },
    [applyFields]
  );
  const beginFieldInteraction = useCallback((): void => {
    if (fieldInteractionSnapshotRef.current) {
      return;
    }
    fieldInteractionSnapshotRef.current = fieldsRef.current;
    fieldInteractionDirtyRef.current = isDirty;
  }, [isDirty]);
  const endFieldInteraction = useCallback(
    (committed: boolean): void => {
      const snapshot = fieldInteractionSnapshotRef.current;
      fieldInteractionSnapshotRef.current = null;
      if (!snapshot) {
        return;
      }
      if (!committed) {
        applyFields(snapshot);
        setIsDirty(fieldInteractionDirtyRef.current);
        return;
      }
      fieldHistoryRef.current.push(snapshot);
      setUndoCount(fieldHistoryRef.current.length);
    },
    [applyFields]
  );
  const undoLastFieldInteraction = useCallback((): void => {
    const previousFields = fieldHistoryRef.current.pop();
    if (!previousFields) {
      return;
    }
    applyFields(previousFields);
    setIsDirty(true);
    setUndoCount(fieldHistoryRef.current.length);
  }, [applyFields]);

  useEffect(() => {
    if (undoCount === 0) {
      return;
    }
    const handleUndoShortcut = (event: KeyboardEvent): void => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.shiftKey ||
        event.key.toLowerCase() !== "z"
      ) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      undoLastFieldInteraction();
    };
    window.addEventListener("keydown", handleUndoShortcut);
    return () => window.removeEventListener("keydown", handleUndoShortcut);
  }, [undoCount, undoLastFieldInteraction]);

  const handleSignatureFileSelect = useCallback(
    async (file: File | null): Promise<void> => {
      const requestId = signatureUploadRequestIdRef.current + 1;
      signatureUploadRequestIdRef.current = requestId;
      const previousSignatureFile = signatureFile;
      const previousSignatureRemoved = signatureRemoved;
      const previousSignatureUpload = signatureUpload;
      selectSignatureFile({
        file,
        setIsDirty,
        setSignatureFile,
        setSignatureRemoved,
      });
      setSignatureUpload(null);
      if (!file) {
        return;
      }

      setPendingImageUploads((current) => current + 1);
      try {
        const upload = await uploadStagedAdminImage({
          aggregateId: courseId,
          file,
          purpose: "certificate-signature",
        });
        if (signatureUploadRequestIdRef.current !== requestId) {
          return;
        }
        setSignatureUpload(upload);
      } catch (error) {
        if (signatureUploadRequestIdRef.current !== requestId) {
          return;
        }
        setSignatureFile(previousSignatureFile);
        setSignatureRemoved(previousSignatureRemoved);
        setSignatureUpload(previousSignatureUpload);
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível enviar a assinatura."
        );
      } finally {
        setPendingImageUploads((current) => Math.max(0, current - 1));
      }
    },
    [courseId, signatureFile, signatureRemoved, signatureUpload]
  );
  const handleSignerNameChange = useCallback((value: string): void => {
    setSignerName(value);
    setIsDirty(true);
  }, []);
  const handleSignerRoleChange = useCallback((value: string): void => {
    setSignerRole(value);
    setIsDirty(true);
  }, []);
  const handleBackgroundFileSelect = useCallback((file: File | null): void => {
    if (!file) {
      backgroundUploadRequestIdRef.current += 1;
      setBackgroundUpload(null);
    }
    selectBackgroundFile({
      file,
      setBackgroundFile,
      setBackgroundRemoved,
      setCropSource,
      setIsDirty,
    });
  }, []);
  const isBusy = isSaving || isPublishing || pendingImageUploads > 0;
  const hasPublishableChanges = isDirty || template?.status === "draft";
  const selectedFieldConfig = selectedField
    ? fields.find((field) => field.field === selectedField)
    : undefined;
  const canFitSelectedField = isFittableCertificateField(
    selectedField,
    selectedFieldConfig
  );
  const requestFitContent = useCallback((): void => {
    if (selectedField && canFitSelectedField) {
      fitRequestIdRef.current += 1;
      setFitContentRequest({
        field: selectedField,
        id: fitRequestIdRef.current,
      });
    }
  }, [canFitSelectedField, selectedField]);

  const updateSelectedFieldPosition = useCallback(
    (position: Pick<CertificateTemplateField, "x" | "y">): void => {
      if (!selectedField) {
        return;
      }
      const field = fieldsRef.current.find(
        (item) => item.field === selectedField
      );
      if (!field || (field.x === position.x && field.y === position.y)) {
        return;
      }
      beginFieldInteraction();
      updateFieldGeometry(selectedField, {
        height: field.height,
        width: field.width,
        x: position.x,
        y: position.y,
      });
      endFieldInteraction(true);
    },
    [
      beginFieldInteraction,
      endFieldInteraction,
      selectedField,
      updateFieldGeometry,
    ]
  );
  const inspectorTitle = getCertificateInspectorTitle(
    backgroundSelected,
    selectedField
  );
  const inspector = (
    <CertificateTemplateInspector
      disabled={isBusy}
      hasPublishableChanges={hasPublishableChanges}
      overlaps={overlaps}
      templateFieldError={templateFieldError}
    >
      <CertificateTemplateFields
        backgroundFile={backgroundFile}
        backgroundImageName={backgroundImageName}
        backgroundPreviewUrl={backgroundPreviewUrl}
        backgroundSelected={backgroundSelected}
        fields={fields}
        formId={CERTIFICATE_TEMPLATE_FORM_ID}
        onBackgroundFileSelect={handleBackgroundFileSelect}
        onFieldChange={updateField}
        onFieldInteractionEnd={endFieldInteraction}
        onFieldInteractionStart={beginFieldInteraction}
        onFieldSelect={selectField}
        onSignatureFileSelect={handleSignatureFileSelect}
        onSignerNameChange={handleSignerNameChange}
        onSignerRoleChange={handleSignerRoleChange}
        selectedField={selectedField}
        signatureFile={signatureFile}
        signatureImageName={signatureImageName}
        signaturePreviewUrl={signaturePreviewUrl}
        signerName={signerName}
        signerRole={signerRole}
      />
    </CertificateTemplateInspector>
  );

  return (
    <div className="flex min-w-0 flex-col">
      <CertificateTemplateSessionHeader
        backgroundPreviewUrl={backgroundPreviewUrl}
        hasPublishableChanges={hasPublishableChanges}
        isBusy={isBusy}
        isDirty={isDirty}
        isPublishing={isPublishing}
        isSaving={isSaving}
        issuerConfigured={issuerConfigured}
        onPublish={publishTemplate}
        status={status}
        template={template}
      >
        {children}
      </CertificateTemplateSessionHeader>

      <form
        action={saveTemplate}
        className="flex min-w-0 flex-col gap-4"
        id={CERTIFICATE_TEMPLATE_FORM_ID}
      >
        <input name="courseId" type="hidden" value={courseId} />
        <input
          name="signatureKey"
          type="hidden"
          value={signaturePreviewUrl ? (template?.signatureKey ?? "") : ""}
        />
        <input name="spec" type="hidden" value={JSON.stringify(spec)} />
        <CertificateTemplateCropDialog
          file={cropSource}
          onCancel={() => setCropSource(null)}
          onComplete={async (file) => {
            const requestId = backgroundUploadRequestIdRef.current + 1;
            backgroundUploadRequestIdRef.current = requestId;
            const previousBackgroundFile = backgroundFile;
            const previousBackgroundRemoved = backgroundRemoved;
            const previousBackgroundUpload = backgroundUpload;
            setBackgroundFile(file);
            setBackgroundRemoved(false);
            setCropSource(null);
            setIsDirty(true);
            setBackgroundUpload(null);
            setPendingImageUploads((current) => current + 1);
            try {
              const upload = await uploadStagedAdminImage({
                aggregateId: courseId,
                file,
                purpose: "certificate-background",
              });
              if (backgroundUploadRequestIdRef.current !== requestId) {
                return;
              }
              setBackgroundUpload(upload);
            } catch (error) {
              if (backgroundUploadRequestIdRef.current !== requestId) {
                return;
              }
              setBackgroundFile(previousBackgroundFile);
              setBackgroundRemoved(previousBackgroundRemoved);
              setBackgroundUpload(previousBackgroundUpload);
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Não foi possível enviar a arte."
              );
            } finally {
              setPendingImageUploads((current) => Math.max(0, current - 1));
            }
          }}
        />

        <div className="flex min-h-0 flex-col">
          <div className="px-4 pt-4 empty:hidden">
            <TemplateFormNotices
              hasPublishedTemplate={hasPublishedTemplate}
              issuerConfigured={issuerConfigured}
              lastAction={lastAction}
              publishState={publishState}
              saveState={saveState}
            />
          </div>
          <div
            className="grid min-h-0 min-w-0 overflow-hidden border-t lg:h-[min(72dvh,52rem)] lg:min-h-[32rem] lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]"
            data-certificate-workspace="true"
          >
            <section className="flex min-h-0 min-w-0 flex-col border-b lg:border-r lg:border-b-0">
              <header
                className="flex h-9 shrink-0 items-center justify-between gap-3 border-b px-3"
                data-preview-header="true"
              >
                <h3 className="font-semibold text-sm">Preview</h3>
                <div
                  aria-label="Ferramentas do preview"
                  className="flex min-w-0 items-center gap-1"
                  data-preview-toolbar="true"
                  role="toolbar"
                >
                  <TooltipProvider delayDuration={250}>
                    <PreviewToolbarTooltip label="Desfazer">
                      <Button
                        aria-label="Desfazer última alteração"
                        className="size-11 lg:size-6"
                        disabled={undoCount === 0 || isBusy}
                        onClick={undoLastFieldInteraction}
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                      >
                        <HugeiconsIcon icon={Undo02Icon} />
                        <span className="sr-only">Desfazer</span>
                      </Button>
                    </PreviewToolbarTooltip>
                    <PreviewToolbarTooltip label="Centralizar horizontalmente no A4">
                      <Button
                        aria-label="Centralizar horizontalmente no A4"
                        className="size-11 lg:size-6"
                        disabled={!selectedField || isBusy}
                        onClick={() => {
                          if (!selectedField) {
                            return;
                          }
                          const field = fieldsRef.current.find(
                            (item) => item.field === selectedField
                          );
                          if (!field) {
                            return;
                          }
                          updateSelectedFieldPosition({
                            x: (100 - field.width) / 2,
                            y: field.y,
                          });
                        }}
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                      >
                        <HugeiconsIcon icon={AlignHorizontalCenterIcon} />
                        <span className="sr-only">
                          Centralizar horizontalmente
                        </span>
                      </Button>
                    </PreviewToolbarTooltip>
                    <PreviewToolbarTooltip label="Centralizar verticalmente no A4">
                      <Button
                        aria-label="Centralizar verticalmente no A4"
                        className="size-11 lg:size-6"
                        disabled={!selectedField || isBusy}
                        onClick={() => {
                          if (!selectedField) {
                            return;
                          }
                          const field = fieldsRef.current.find(
                            (item) => item.field === selectedField
                          );
                          if (!field) {
                            return;
                          }
                          updateSelectedFieldPosition({
                            x: field.x,
                            y: (100 - field.height) / 2,
                          });
                        }}
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                      >
                        <HugeiconsIcon icon={AlignVerticalCenterIcon} />
                        <span className="sr-only">
                          Centralizar verticalmente
                        </span>
                      </Button>
                    </PreviewToolbarTooltip>
                    <PreviewToolbarTooltip label="Ajustar ao conteúdo">
                      <Button
                        aria-label="Ajustar tamanho ao conteúdo"
                        className="size-11 lg:size-6"
                        disabled={!canFitSelectedField || isBusy}
                        onClick={requestFitContent}
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                      >
                        <HugeiconsIcon icon={FitToScreenIcon} />
                        <span className="sr-only">
                          Ajustar tamanho ao conteúdo
                        </span>
                      </Button>
                    </PreviewToolbarTooltip>
                  </TooltipProvider>
                  <CertificateTemplateVisibilitySheet
                    compact
                    fields={fields}
                    onFieldChange={(field, visible) =>
                      updateField(field, "visible", visible)
                    }
                    onFieldSelect={selectField}
                    overlapFields={overlapFields}
                  />
                  <Button
                    aria-pressed={previewVariant === "long"}
                    className="h-11 lg:h-6"
                    data-preview-sample-toggle="true"
                    onClick={() =>
                      setPreviewVariant((current) =>
                        current === "short" ? "long" : "short"
                      )
                    }
                    size="xs"
                    type="button"
                    variant="ghost"
                  >
                    Dados {previewVariant === "long" ? "longos" : "curtos"}
                  </Button>
                </div>
              </header>
              <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-0">
                <CertificateTemplatePreview
                  backgroundSelected={backgroundSelected}
                  backgroundUrl={backgroundPreviewUrl}
                  courseWorkloadHours={courseWorkloadHours}
                  fields={fields}
                  fitContentRequest={fitContentRequest}
                  onBackgroundSelect={selectBackground}
                  onFieldGeometryChange={updateFieldGeometry}
                  onFieldInteractionEnd={endFieldInteraction}
                  onFieldInteractionStart={beginFieldInteraction}
                  onFieldPositionChange={updateFieldPosition}
                  onFieldSelect={selectField}
                  overlapFields={overlapFields}
                  selectedField={selectedField}
                  signatureUrl={signaturePreviewUrl}
                  signerName={signerName}
                  signerRole={signerRole}
                  variant={previewVariant}
                />
              </div>
            </section>

            {isCompact ? (
              <Sheet
                onOpenChange={setPropertiesSheetOpen}
                open={propertiesSheetOpen}
              >
                <SheetContent
                  className="max-h-[85dvh] [&_[data-slot=sheet-close]]:size-11"
                  data-mobile-properties-sheet="true"
                  side="bottom"
                >
                  <SheetHeader className="border-b px-4 py-4 pr-14">
                    <SheetTitle>{inspectorTitle}</SheetTitle>
                  </SheetHeader>
                  <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4">
                    {inspector}
                  </div>
                </SheetContent>
              </Sheet>
            ) : (
              <section
                className="flex min-h-0 min-w-0 flex-col"
                data-properties-panel="true"
              >
                <header className="flex h-9 shrink-0 items-center border-b px-3">
                  <h3 className="font-semibold text-sm">Propriedades</h3>
                </header>
                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-2">
                  {inspector}
                </div>
              </section>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
