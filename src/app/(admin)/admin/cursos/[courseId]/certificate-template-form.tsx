"use client";

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
import { CertificateImageUploadField } from "@/components/certificate-image-upload-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  type CertificateTemplateSpec,
  createDefaultCertificateTemplateFields,
} from "@/features/certificates/template-rules";
import type { StagedAdminImageReference } from "@/features/storage/staged-image-upload";
import { uploadStagedAdminImage } from "@/features/storage/staged-image-upload-client";
import { useOwnedObjectUrl } from "@/hooks/use-owned-object-url";
import {
  type CertificateFieldChange,
  CertificateTemplateFields,
} from "./certificate-template-fields";
import { applyCertificateTemplateUploads } from "./certificate-template-form-data";
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

const TemplateFormNotices = ({
  issuerConfigured,
  saveState,
}: {
  issuerConfigured: boolean;
  saveState: CertificateTemplateActionState;
}): React.JSX.Element => (
  <>
    {issuerConfigured ? null : (
      <Alert variant="destructive">
        <AlertTitle>Perfil emissor pendente</AlertTitle>
        <AlertDescription>
          Cadastre razão social, nome de marca e CNPJ em Configurações antes de
          publicar.
        </AlertDescription>
      </Alert>
    )}
    {saveState.status === "error" ? (
      <Alert variant="destructive">
        <AlertTitle>Rascunho não salvo</AlertTitle>
        <AlertDescription>{saveState.message}</AlertDescription>
      </Alert>
    ) : null}
  </>
);

const TemplateVersionBadges = ({
  isDirty,
  template,
}: {
  isDirty: boolean;
  template: CertificateTemplateEditorTemplate | undefined;
}): React.JSX.Element => (
  <div className="mt-1 flex items-center gap-2">
    {template ? (
      <span className="text-muted-foreground text-xs">
        Versão {template.version}{" "}
        {template.status === "draft" ? "(Rascunho)" : "(Publicada)"}
      </span>
    ) : (
      <Badge variant="secondary">Nova arte</Badge>
    )}
    {isDirty ? <Badge variant="outline">Alteracoes nao salvas</Badge> : null}
  </div>
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
      Altere o template ou crie um rascunho para publicar uma nova versao.
    </p>
  );
};

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
  courseId,
  issuerConfigured,
  template,
}: {
  courseId: string;
  issuerConfigured: boolean;
  template: CertificateTemplateEditorTemplate | undefined;
}): React.JSX.Element {
  const router = useRouter();
  const backgroundUploadRequestIdRef = useRef(0);
  const signatureUploadRequestIdRef = useRef(0);
  const [fields, setFields] = useState(
    template?.spec.fields ?? createDefaultCertificateTemplateFields
  );

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
  const [pendingImageUploads, setPendingImageUploads] = useState(0);
  const [signerName, setSignerName] = useState(template?.signerName ?? "");
  const [signerRole, setSignerRole] = useState(template?.signerRole ?? "");
  const backgroundObjectUrl = useOwnedObjectUrl(backgroundFile);
  const signatureObjectUrl = useOwnedObjectUrl(signatureFile);

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
    saveAction(formData);
  };
  const publishTemplate = (formData: FormData): void => {
    prepareSubmission(formData);
    publishAction(formData);
  };

  useEffect(() => {
    notifyTemplateAction({
      onSuccess: () => {
        setBackgroundFile(null);
        setBackgroundUpload(null);
        setSignatureFile(null);
        setSignatureUpload(null);
        setCropSource(null);
        setIsDirty(false);
        router.refresh();
      },
      state: saveState,
    });
  }, [router, saveState]);

  useEffect(() => {
    notifyTemplateAction({
      onSuccess: () => {
        setBackgroundFile(null);
        setBackgroundUpload(null);
        setSignatureFile(null);
        setSignatureUpload(null);
        setCropSource(null);
        setIsDirty(false);
        router.refresh();
      },
      state: publishState,
    });
  }, [publishState, router]);

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

  const updateField = useCallback<CertificateFieldChange>(
    (name, key, value): void => {
      setIsDirty(true);
      setFields((current) =>
        current.map((field) =>
          field.field === name ? { ...field, [key]: value } : field
        )
      );
    },
    []
  );
  const handleSignatureFileSelect = useCallback(
    async (file: File | null): Promise<void> => {
      const requestId = signatureUploadRequestIdRef.current + 1;
      signatureUploadRequestIdRef.current = requestId;
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
        setSignatureFile(null);
        setSignatureRemoved(true);
        toast.error(
          error instanceof Error
            ? error.message
            : "Nao foi possivel enviar a assinatura."
        );
      } finally {
        setPendingImageUploads((current) => Math.max(0, current - 1));
      }
    },
    [courseId]
  );
  const handleSignerNameChange = useCallback((value: string): void => {
    setSignerName(value);
    setIsDirty(true);
  }, []);
  const handleSignerRoleChange = useCallback((value: string): void => {
    setSignerRole(value);
    setIsDirty(true);
  }, []);

  const isBusy = isSaving || isPublishing || pendingImageUploads > 0;
  const hasPublishableChanges = isDirty || template?.status === "draft";

  return (
    <form action={saveTemplate} className="flex flex-col gap-4">
      <CertificateTemplateCropDialog
        file={cropSource}
        onCancel={() => setCropSource(null)}
        onComplete={async (file) => {
          const requestId = backgroundUploadRequestIdRef.current + 1;
          backgroundUploadRequestIdRef.current = requestId;
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
            setBackgroundFile(null);
            setBackgroundRemoved(true);
            toast.error(
              error instanceof Error
                ? error.message
                : "Nao foi possivel enviar a arte."
            );
          } finally {
            setPendingImageUploads((current) => Math.max(0, current - 1));
          }
        }}
      />
      <TemplateFormNotices
        issuerConfigured={issuerConfigured}
        saveState={saveState}
      />

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        {/* Left Column: Fixed Preview (50%) */}
        <div className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-8 lg:w-1/2">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Preview</CardTitle>
                <TemplateVersionBadges isDirty={isDirty} template={template} />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <input name="courseId" type="hidden" value={courseId} />
                {/* Se signaturePreviewUrl for nulo, a key é apagada, indicando exclusão no server */}
                <input
                  name="signatureKey"
                  type="hidden"
                  value={
                    signaturePreviewUrl ? (template?.signatureKey ?? "") : ""
                  }
                />
                <input name="spec" type="hidden" value={JSON.stringify(spec)} />
                <Button
                  disabled={!isDirty || isBusy}
                  name="intent"
                  type="submit"
                  value="save"
                  variant="secondary"
                >
                  {isSaving ? "Salvando..." : "Salvar rascunho"}
                </Button>
                <Button
                  onClick={() =>
                    setPreviewVariant((current) =>
                      current === "short" ? "long" : "short"
                    )
                  }
                  type="button"
                  variant="outline"
                >
                  Dados {previewVariant === "short" ? "longos" : "curtos"}
                </Button>
                <Button
                  disabled={
                    !(
                      issuerConfigured &&
                      backgroundPreviewUrl &&
                      hasPublishableChanges
                    ) || isBusy
                  }
                  formAction={publishTemplate}
                  name="intent"
                  type="submit"
                  value="publish"
                  variant="default"
                >
                  {isPublishing ? "Publicando..." : "Salvar e publicar"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <CertificateTemplatePreview
                backgroundUrl={backgroundPreviewUrl}
                fields={fields}
                signatureUrl={signaturePreviewUrl}
                signerName={signerName}
                variant={previewVariant}
              />
              <FieldError className="mt-4 text-center">
                {saveState.fieldErrors?.template ??
                  publishState.fieldErrors?.template}
              </FieldError>
              <NoPublishableChangesHint
                hasPublishableChanges={hasPublishableChanges}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Scrollable Settings (50%) */}
        <div className="flex w-full flex-col lg:w-1/2">
          <Card className="flex h-[calc(100vh-16rem)] min-h-[600px] flex-col overflow-hidden">
            <CardHeader className="shrink-0 border-b">
              <CardTitle>Configurações</CardTitle>
              <CardDescription>
                Arte de fundo, assinaturas e posições.
              </CardDescription>
            </CardHeader>
            <ScrollArea className="flex-1">
              <fieldset className="flex flex-col gap-6 p-4" disabled={isBusy}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="certificate-background">
                      Arte A4 horizontal
                    </FieldLabel>
                    <CertificateImageUploadField
                      id="certificate-background"
                      imageUrl={backgroundPreviewUrl}
                      kind="background"
                      label="Arraste a arte A4 (horizontal)"
                      onFileSelect={(file) => {
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
                      }}
                      required={!backgroundPreviewUrl}
                      selectedFile={backgroundFile}
                    />
                  </Field>
                </FieldGroup>

                <CertificateTemplateFields
                  fields={fields}
                  onFieldChange={updateField}
                  onSignatureFileSelect={handleSignatureFileSelect}
                  onSignerNameChange={handleSignerNameChange}
                  onSignerRoleChange={handleSignerRoleChange}
                  signatureFile={signatureFile}
                  signaturePreviewUrl={signaturePreviewUrl}
                  signerName={signerName}
                  signerRole={signerRole}
                />
              </fieldset>
            </ScrollArea>
          </Card>
        </div>
      </div>
    </form>
  );
}
