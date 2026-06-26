"use client";

import {
  Add01Icon,
  CloudUploadIcon,
  Delete02Icon,
  File01Icon,
  FileArchiveIcon,
  FileDownloadIcon,
  FileImageIcon,
  FileLinkIcon,
  Pdf01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { toast } from "sonner";
import { JmvstreamDurationDetector } from "@/components/jmvstream-duration-detector";
import {
  type JmvstreamUploadAsset,
  JmvstreamUploadPanel,
} from "@/components/jmvstream-upload-panel";
import { LessonVideoEditorPreview } from "@/components/lesson-video-editor-preview";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getLessonVideoEditorMode,
  resolveLessonVideoPreviewUrl,
} from "@/features/admin/lesson-video-form";
import type { LessonResource } from "@/features/courses/lesson-content";
import {
  LESSON_ATTACHMENT_ACCEPT,
  LESSON_RESOURCE_IMAGE_PREVIEW,
  validateLessonAttachmentUpload,
} from "@/features/storage/r2-objects";
import { cn } from "@/lib/utils";

export function LessonVideoControls({
  asset,
  defaultEmbedUrl,
  defaultOrder,
  defaultTitle,
  defaultVideoDurationSeconds,
  defaultVideoExternalId,
  lessonId,
}: {
  asset?: JmvstreamUploadAsset | undefined;
  defaultEmbedUrl: string;
  defaultOrder: number;
  defaultTitle: string;
  defaultVideoDurationSeconds: number;
  defaultVideoExternalId: null | string;
  lessonId?: string | undefined;
}): React.JSX.Element {
  const initialVideoMode = getLessonVideoEditorMode({
    videoEmbedUrl: defaultEmbedUrl || null,
    videoExternalId: defaultVideoExternalId,
  });
  const [appliedEmbedUrl, setAppliedEmbedUrl] = useState(defaultEmbedUrl);
  const [linkDraft, setLinkDraft] = useState(defaultEmbedUrl);
  const [isRemovePending, setIsRemovePending] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const previewUrl = resolveLessonVideoPreviewUrl({
    savedEmbedUrl: defaultEmbedUrl || null,
    shouldRemoveVideo: isRemovePending,
    submittedEmbedUrl: appliedEmbedUrl || null,
  });
  const hasManualLinkApplied = Boolean(
    appliedEmbedUrl &&
      (!defaultVideoExternalId || appliedEmbedUrl !== defaultEmbedUrl)
  );

  const removeVideoLocally = (): void => {
    setAppliedEmbedUrl("");
    setIsRemovePending(true);
    setLinkDraft("");
    setLinkError(null);
  };

  const applyManualLink = (): void => {
    const normalizedUrl = resolveLessonVideoPreviewUrl({
      savedEmbedUrl: null,
      shouldRemoveVideo: false,
      submittedEmbedUrl: linkDraft,
    });

    if (!normalizedUrl) {
      setLinkError("Informe um link ou iframe valido da JMVStream.");
      return;
    }

    setAppliedEmbedUrl(normalizedUrl);
    setIsRemovePending(false);
    setLinkDraft(normalizedUrl);
    setLinkError(null);
  };

  const removeManualLink = (): void => {
    if (defaultVideoExternalId && defaultEmbedUrl) {
      setAppliedEmbedUrl(defaultEmbedUrl);
      setLinkDraft("");
      setIsRemovePending(false);
      setLinkError(null);
      return;
    }

    removeVideoLocally();
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-xl border bg-background p-6 shadow-sm">
      <input
        defaultValue={defaultVideoDurationSeconds}
        name="durationSeconds"
        type="hidden"
      />
      <input defaultValue={defaultOrder} name="sortOrder" type="hidden" />
      <input
        name="videoEmbedUrl"
        readOnly
        type="hidden"
        value={isRemovePending ? "" : appliedEmbedUrl}
      />
      {isRemovePending ? (
        <input name="removeVideo" type="hidden" value="on" />
      ) : null}

      <input name="videoProvider" type="hidden" value="jmvstream" />
      <Tabs className="w-full min-w-0" defaultValue={initialVideoMode}>
        <TabsList className="grid h-auto min-h-9 w-full min-w-0 grid-cols-2">
          <TabsTrigger
            className="min-w-0 whitespace-normal text-center leading-tight"
            value="upload"
          >
            Upload
          </TabsTrigger>
          <TabsTrigger
            className="min-w-0 whitespace-normal text-center leading-tight"
            value="link"
          >
            Link
          </TabsTrigger>
        </TabsList>
        <TabsContent className="pt-4" value="upload">
          <JmvstreamUploadPanel
            asset={asset}
            currentVideoHash={defaultVideoExternalId}
            isRemovePending={isRemovePending}
            lessonId={lessonId}
            {...(defaultVideoExternalId
              ? { onRemoveVideo: removeVideoLocally }
              : {})}
          />
        </TabsContent>
        <TabsContent className="pt-4" value="link">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm">Link ou iframe</h3>
                <p className="mt-1 text-muted-foreground text-xs">
                  Insira o link direto ou o código iframe de incorporação do
                  player da JMVStream.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Input
                className="w-full"
                onChange={(event) => {
                  setLinkDraft(event.target.value);
                  setLinkError(null);
                }}
                placeholder="https://player.jmvstream.com/... ou iframe oficial"
                value={linkDraft}
              />
              <div className="flex flex-col justify-end gap-2 sm:flex-row">
                {hasManualLinkApplied ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        className="w-full sm:w-auto"
                        type="button"
                        variant="destructive"
                      >
                        Remover link
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover link</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja remover o link deste vídeo?
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={removeManualLink}>
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
                <Button
                  className="w-full sm:w-auto"
                  disabled={!linkDraft.trim()}
                  onClick={applyManualLink}
                  type="button"
                >
                  Aplicar link
                </Button>
              </div>
            </div>

            {linkError ? (
              <p className="text-destructive text-xs">{linkError}</p>
            ) : null}
          </div>
          <JmvstreamDurationDetector
            defaultEmbedUrl={isRemovePending ? "" : appliedEmbedUrl}
            defaultProvider="jmvstream"
            key={`${isRemovePending ? "removed" : "active"}:${appliedEmbedUrl}`}
            showDetectedMessage={false}
          />
        </TabsContent>
      </Tabs>
      {previewUrl ? (
        <div className="pt-4">
          <LessonVideoEditorPreview
            previewUrl={previewUrl}
            title={defaultTitle}
          />
        </div>
      ) : null}
    </div>
  );
}

function getResourceExtension(resource: EditableLessonResource): string | null {
  if (resource.storage !== "r2") {
    return null;
  }
  const parts = resource.fileName.split(".");
  return parts.length > 1 ? (parts.pop()?.toLowerCase() ?? null) : null;
}

function getResourceIcon(resource: EditableLessonResource) {
  const extension = getResourceExtension(resource);

  if (resource.storage !== "r2") {
    return FileLinkIcon;
  }
  if (resource.contentType?.startsWith("image/")) {
    return FileImageIcon;
  }
  if (extension === "pdf") {
    return Pdf01Icon;
  }
  if (extension === "zip") {
    return FileArchiveIcon;
  }
  if (
    extension &&
    ["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(extension)
  ) {
    return FileDownloadIcon;
  }

  return File01Icon;
}

function getResourceTone(_resource: EditableLessonResource): string {
  return "bg-muted/50 text-muted-foreground";
}

function AdminResourceVisual({
  lessonId,
  resource,
}: {
  lessonId: string | undefined;
  resource: EditableLessonResource;
}): React.JSX.Element {
  if (resource.storage === "r2" && resource.preview) {
    const backgroundUrl =
      resource.localPreviewUrl ||
      (lessonId
        ? `/api/lessons/${lessonId}/resources/${resource.id}/preview`
        : null);

    if (backgroundUrl) {
      return (
        <div
          aria-label={`Preview de ${resource.label}`}
          className="aspect-video overflow-hidden rounded-md bg-center bg-cover bg-muted shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
          role="img"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
          }}
        />
      );
    }
  }

  const Icon = getResourceIcon(resource);
  const tone = getResourceTone(resource);

  return (
    <div
      className={cn(
        "flex aspect-video items-center justify-center rounded-md shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
        tone
      )}
    >
      <HugeiconsIcon icon={Icon} size={22} strokeWidth={2} />
    </div>
  );
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    })} MB`;
  }

  return `${Math.max(1, Math.round(sizeBytes / 1024)).toLocaleString(
    "pt-BR"
  )} KB`;
}

function getFileTypeLabel(resource: EditableLessonResource): string {
  const extension = getResourceExtension(resource);

  if (resource.storage !== "r2") {
    return "Link";
  }
  if (resource.contentType?.startsWith("image/")) {
    return "Imagem";
  }
  if (extension === "pdf") {
    return "PDF";
  }
  if (extension && ["doc", "docx"].includes(extension)) {
    return "Documento";
  }
  if (extension && ["xls", "xlsx", "csv"].includes(extension)) {
    return "Planilha";
  }
  if (extension && ["ppt", "pptx"].includes(extension)) {
    return "Apresentação";
  }
  if (extension === "zip") {
    return "Arquivo compactado";
  }
  return "Arquivo";
}

export function LessonResourcesFields({
  defaultResources,
  formId,
  lessonId,
}: {
  defaultResources: LessonResource[];
  formId?: string | undefined;
  lessonId?: string | undefined;
}): React.JSX.Element {
  const formProps = formId ? { form: formId } : {};
  const [resources, setResources] = useState(() =>
    defaultResources.length > 0 ? defaultResources.map(toEditableResource) : []
  );

  const [uploadingFiles, setUploadingFiles] = useState<
    { id: string; file: File; progress: number }[]
  >([]);

  const addResource = (): void => {
    setResources((current) => [...current, createEmptyExternalResource()]);
  };

  const removeResource = (id: string): void => {
    setResources((current) => current.filter((resource) => resource.id !== id));
  };

  const uploadResource = async (file: File): Promise<void> => {
    if (!lessonId) {
      toast.error("Salve a aula antes de enviar anexos.");
      return;
    }

    const tempId = `temp-${Date.now()}`;
    setUploadingFiles((prev) => [...prev, { id: tempId, file, progress: 0 }]);

    const interval = setInterval(() => {
      setUploadingFiles((prev) =>
        prev.map((f) => {
          if (f.id === tempId) {
            const step = Math.random() * 15 + 5;
            return { ...f, progress: Math.min(f.progress + step, 90) };
          }
          return f;
        })
      );
    }, 200);

    try {
      const signedUpload = await prepareSignedResourceUpload({
        file,
        lessonId,
      });
      await uploadSignedResource({ file, signedUpload });

      clearInterval(interval);
      setUploadingFiles((prev) =>
        prev.map((f) => (f.id === tempId ? { ...f, progress: 100 } : f))
      );

      // Delay for progress to reach 100% visually
      await new Promise((r) => setTimeout(r, 400));

      const newResource = toEditableResource(signedUpload.payload.resource);
      if (newResource.storage === "r2" && signedUpload.preview) {
        newResource.localPreviewUrl = URL.createObjectURL(
          signedUpload.preview.blob
        );
      }

      setResources((current) => [...current, newResource]);
      setUploadingFiles((prev) => prev.filter((f) => f.id !== tempId));
      toast.success("Anexo enviado. Salve a aula para publicar o material.");
    } catch (error) {
      clearInterval(interval);
      setUploadingFiles((prev) => prev.filter((f) => f.id !== tempId));
      toast.error(
        error instanceof Error ? error.message : "Nao foi possivel enviar."
      );
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex min-h-52 flex-col overflow-hidden rounded-xl border border-border border-dashed p-4 transition-colors hover:border-ring/50">
        <div className="flex w-full flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-medium text-sm">
              Anexos ({resources.length})
            </h3>
            <div className="flex gap-2">
              <div className="relative">
                <input
                  accept={LESSON_ATTACHMENT_ACCEPT}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    if (file) {
                      uploadResource(file).catch(() => undefined);
                    }
                  }}
                  title="Enviar arquivo"
                  type="file"
                />
                <Button
                  className="pointer-events-none h-8 px-3"
                  size="sm"
                  variant="outline"
                >
                  <HugeiconsIcon
                    aria-hidden="true"
                    className="-ms-0.5 mr-1.5 opacity-60"
                    icon={CloudUploadIcon}
                    size={14}
                  />
                  Upload
                </Button>
              </div>
              <Button
                className="h-8 px-3"
                onClick={addResource}
                size="sm"
                type="button"
                variant="outline"
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  className="-ms-0.5 mr-1.5 opacity-60"
                  icon={Add01Icon}
                  size={14}
                />
                Link
              </Button>
            </div>
          </div>

          {resources.length > 0 || uploadingFiles.length > 0 ? (
            <div className="w-full space-y-2">
              {resources.map((resource) => {
                const extension = getResourceExtension(resource);
                const typeLabel = getFileTypeLabel(resource);
                const badgeText =
                  resource.storage === "r2" ? extension : "LINK";

                return (
                  <div
                    className="group flex flex-col gap-1 rounded-lg border bg-background p-2 pe-3 transition-opacity duration-300"
                    key={resource.id}
                  >
                    <input
                      name="resourceStorage[]"
                      type="hidden"
                      value={resource.storage}
                      {...formProps}
                    />
                    {resource.storage === "r2" ? (
                      <>
                        <input
                          name="resourceUrl[]"
                          type="hidden"
                          value=""
                          {...formProps}
                        />
                        <input
                          name="resourceKey[]"
                          type="hidden"
                          value={resource.key}
                          {...formProps}
                        />
                        <input
                          name="resourceFileName[]"
                          type="hidden"
                          value={resource.fileName}
                          {...formProps}
                        />
                        <input
                          name="resourceContentType[]"
                          type="hidden"
                          value={resource.contentType}
                          {...formProps}
                        />
                        <input
                          name="resourcePreview[]"
                          type="hidden"
                          value={
                            resource.preview
                              ? JSON.stringify(resource.preview)
                              : ""
                          }
                          {...formProps}
                        />
                        <input
                          name="resourceSizeBytes[]"
                          type="hidden"
                          value={resource.sizeBytes ?? ""}
                          {...formProps}
                        />
                      </>
                    ) : (
                      <>
                        <input
                          name="resourceKey[]"
                          type="hidden"
                          value=""
                          {...formProps}
                        />
                        <input
                          name="resourceFileName[]"
                          type="hidden"
                          value=""
                          {...formProps}
                        />
                        <input
                          name="resourceContentType[]"
                          type="hidden"
                          value=""
                          {...formProps}
                        />
                        <input
                          name="resourcePreview[]"
                          type="hidden"
                          value=""
                          {...formProps}
                        />
                        <input
                          name="resourceSizeBytes[]"
                          type="hidden"
                          value=""
                          {...formProps}
                        />
                      </>
                    )}

                    <div className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[72px_minmax(0,1fr)_auto]">
                      <AdminResourceVisual
                        lessonId={lessonId}
                        resource={resource}
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Input
                            className="h-auto min-w-0 flex-1 border-transparent bg-transparent p-0 font-medium text-[13px] shadow-none hover:border-input focus-visible:border-input focus-visible:bg-background focus-visible:ring-0 focus-visible:ring-offset-0"
                            defaultValue={resource.label}
                            name="resourceLabel[]"
                            placeholder="Nome do material"
                            {...formProps}
                          />
                          {badgeText ? (
                            <span className="shrink-0 rounded-md bg-muted/80 px-1.5 py-0.5 font-semibold text-[10px] text-muted-foreground uppercase tracking-normal">
                              {badgeText}
                            </span>
                          ) : null}
                        </div>
                        {resource.storage === "r2" ? (
                          <div className="flex items-center gap-2">
                            <p className="truncate text-muted-foreground text-xs">
                              {typeLabel} &bull;{" "}
                              {formatFileSize(resource.sizeBytes ?? 0)}
                            </p>
                          </div>
                        ) : (
                          <Input
                            className="h-auto border-transparent bg-transparent p-0 text-muted-foreground text-xs shadow-none hover:border-input focus-visible:border-input focus-visible:bg-background focus-visible:ring-0 focus-visible:ring-offset-0"
                            defaultValue={resource.url}
                            name="resourceUrl[]"
                            onBlur={(event) => {
                              const normalized = normalizeExternalUrl(
                                event.target.value
                              );
                              if (normalized) {
                                event.target.value = normalized;
                              }
                            }}
                            placeholder="https://..."
                            type="url"
                            {...formProps}
                          />
                        )}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            aria-label="Remover material"
                            className="size-8 text-muted-foreground opacity-50 transition-all hover:bg-destructive/10 hover:text-destructive hover:opacity-100"
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <HugeiconsIcon
                              icon={Delete02Icon}
                              size={16}
                              strokeWidth={2}
                            />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover anexo</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja remover o anexo &quot;
                              {resource.label || "Sem nome"}&quot;? Esta ação
                              não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removeResource(resource.id)}
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}

              {uploadingFiles.map((f) => (
                <div
                  className="group grid grid-cols-[56px_minmax(0,1fr)] items-center gap-3 rounded-lg border bg-background p-2 pe-3 transition-opacity duration-300 sm:grid-cols-[72px_minmax(0,1fr)]"
                  key={f.id}
                >
                  <div className="flex aspect-video items-center justify-center rounded-md bg-muted/50 text-muted-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                    <HugeiconsIcon
                      icon={CloudUploadIcon}
                      size={22}
                      strokeWidth={2}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex flex-col gap-0.5 opacity-60">
                      <p className="truncate font-medium text-[13px]">
                        {f.file.name}
                      </p>
                      <p className="truncate text-muted-foreground text-xs">
                        {formatFileSize(f.file.size)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-all duration-300 ease-out"
                          style={{ width: `${f.progress}%` }}
                        />
                      </div>
                      <span className="w-10 text-muted-foreground text-xs tabular-nums">
                        {Math.round(f.progress)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-1 flex-col items-center justify-center px-4 py-8 text-center">
              <div
                aria-hidden="true"
                className="mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border bg-background"
              >
                <HugeiconsIcon
                  className="opacity-60"
                  icon={FileImageIcon}
                  size={18}
                />
              </div>
              <p className="mb-1.5 font-medium text-sm">
                Arraste seus arquivos aqui
              </p>
              <p className="text-muted-foreground text-xs">
                Suporta DOCs, XLSX, PPTX, PDF, Imagens e ZIP &bull; Máx 150 MB
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type EditableLessonResource =
  | {
      id: string;
      label: string;
      storage: "external";
      url: string;
    }
  | {
      contentType: string;
      fileName: string;
      id: string;
      key: string;
      label: string;
      preview?: {
        contentType: "image/webp";
        height: number;
        key: string;
        sizeBytes: number;
        width: number;
      };
      sizeBytes: number;
      storage: "r2";
      localPreviewUrl?: string;
    };

interface SignedUploadPayload {
  previewUploadUrl?: string;
  resource: Extract<EditableLessonResource, { storage: "r2" }>;
  uploadUrl: string;
}

const createEmptyExternalResource = (): EditableLessonResource => ({
  id: `resource-${crypto.randomUUID()}`,
  label: "",
  storage: "external",
  url: "",
});

const toEditableResource = (
  resource: LessonResource
): EditableLessonResource =>
  resource.storage === "r2"
    ? resource
    : {
        id: resource.id,
        label: resource.label,
        storage: "external",
        url: resource.url,
      };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const whitespacePattern = /\s/;

const normalizeExternalUrl = (value: string): string | null => {
  const trimmed = value.trim();

  if (!trimmed || trimmed.includes("\n") || whitespacePattern.test(trimmed)) {
    return null;
  }

  try {
    const url = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`
    );

    if (!(url.protocol === "http:" || url.protocol === "https:")) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
};

const isSignedUploadPayload = (
  value: unknown
): value is SignedUploadPayload => {
  if (
    !isRecord(value) ||
    typeof value.uploadUrl !== "string" ||
    !(
      value.previewUploadUrl === undefined ||
      typeof value.previewUploadUrl === "string"
    )
  ) {
    return false;
  }

  const resource = value.resource;

  return (
    isRecord(resource) &&
    resource.storage === "r2" &&
    typeof resource.contentType === "string" &&
    typeof resource.fileName === "string" &&
    typeof resource.id === "string" &&
    typeof resource.key === "string" &&
    typeof resource.label === "string" &&
    typeof resource.sizeBytes === "number"
  );
};

const prepareSignedResourceUpload = async ({
  file,
  lessonId,
}: {
  file: File;
  lessonId: string;
}): Promise<{
  payload: SignedUploadPayload;
  preview: GeneratedImagePreview | null;
}> => {
  validateLessonAttachmentUpload({
    contentType: file.type,
    fileName: file.name,
    sizeBytes: file.size,
  });

  const preview = await createImagePreview(file);
  const signedResponse = await fetch(
    `/api/admin/lessons/${lessonId}/resources/upload-url`,
    {
      body: JSON.stringify({
        contentType: file.type,
        fileName: file.name,
        ...(preview
          ? {
              preview: {
                contentType: preview.contentType,
                height: preview.height,
                sizeBytes: preview.blob.size,
                width: preview.width,
              },
            }
          : {}),
        sizeBytes: file.size,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }
  );
  const signedPayload: unknown = await signedResponse.json();

  if (!(signedResponse.ok && isSignedUploadPayload(signedPayload))) {
    throw new Error(readUploadError(signedPayload));
  }

  if (preview && !signedPayload.previewUploadUrl) {
    throw new Error("Upload de preview indisponivel.");
  }

  return { payload: signedPayload, preview };
};

const uploadSignedResource = async ({
  file,
  signedUpload,
}: {
  file: File;
  signedUpload: {
    payload: SignedUploadPayload;
    preview: GeneratedImagePreview | null;
  };
}): Promise<void> => {
  const uploadResponse = await fetch(signedUpload.payload.uploadUrl, {
    body: file,
    headers: { "Content-Type": file.type },
    method: "PUT",
  });

  if (!uploadResponse.ok) {
    throw new Error("Nao foi possivel enviar o arquivo para o R2.");
  }

  if (signedUpload.preview && signedUpload.payload.previewUploadUrl) {
    const previewUploadResponse = await fetch(
      signedUpload.payload.previewUploadUrl,
      {
        body: signedUpload.preview.blob,
        headers: { "Content-Type": signedUpload.preview.contentType },
        method: "PUT",
      }
    );

    if (!previewUploadResponse.ok) {
      throw new Error("Nao foi possivel enviar o preview para o R2.");
    }
  }
};

interface GeneratedImagePreview {
  blob: Blob;
  contentType: "image/webp";
  height: number;
  width: number;
}

const imagePreviewTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const createImagePreview = async (
  file: File
): Promise<GeneratedImagePreview | null> => {
  if (!imagePreviewTypes.has(file.type)) {
    return null;
  }

  const image = await readImage(file);
  const { height, width } = LESSON_RESOURCE_IMAGE_PREVIEW;
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  const sourceWidth =
    sourceRatio > targetRatio
      ? image.naturalHeight * targetRatio
      : image.naturalWidth;
  const sourceHeight =
    sourceRatio > targetRatio
      ? image.naturalHeight
      : image.naturalWidth / targetRatio;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas indisponivel para gerar o preview.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height
  );

  return {
    blob: await canvasToBlob(canvas),
    contentType: "image/webp",
    height,
    width,
  };
};

const readImage = async (file: File): Promise<HTMLImageElement> =>
  await new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Nao foi possivel ler a imagem."));
    };
    image.src = url;
  });

const canvasToBlob = async (canvas: HTMLCanvasElement): Promise<Blob> =>
  await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Nao foi possivel gerar o preview."));
      },
      "image/webp",
      0.78
    );
  });

const readUploadError = (value: unknown): string => {
  if (isRecord(value) && typeof value.error === "string") {
    return value.error;
  }

  return "Nao foi possivel preparar o upload.";
};
