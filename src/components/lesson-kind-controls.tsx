"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Add01Icon,
  CloudUploadIcon,
  Delete02Icon,
  DragDropVerticalIcon,
  File01Icon,
  FileArchiveIcon,
  FileDownloadIcon,
  FileImageIcon,
  FileLinkIcon,
  Link04Icon,
  Pdf01Icon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";
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
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  ResourceDeleteAction,
  ResourceDropzoneEmpty,
  ResourceItem,
  ResourceItemActions,
  ResourceItemContent,
  ResourceItemDragHandle,
  ResourceItemSkeleton,
  ResourceItemVisual,
  ResourceListBody,
  ResourceListContainer,
  ResourceListHeader,
} from "@/components/ui/resource-list";
import { resolveLessonVideoPreviewUrl } from "@/features/admin/lesson-video-form";
import type { LessonResource } from "@/features/courses/lesson-content";
import {
  formatResourceFileSize,
  getResourceTypeLabel,
  getResourceExtension as getSharedResourceExtension,
} from "@/features/courses/resource-presentation";
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
  const isJmvstreamUpload = Boolean(defaultVideoExternalId);
  const initialEmbedUrl = isJmvstreamUpload ? "" : defaultEmbedUrl;
  const [appliedEmbedUrl, setAppliedEmbedUrl] = useState(initialEmbedUrl);
  const [linkDraft, setLinkDraft] = useState(initialEmbedUrl);
  const [isRemovePending, setIsRemovePending] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const previewUrl = resolveLessonVideoPreviewUrl({
    savedEmbedUrl: defaultEmbedUrl || null,
    shouldRemoveVideo: isRemovePending,
    submittedEmbedUrl: appliedEmbedUrl || null,
  });
  const isUploadedVideoProcessing =
    !(previewUrl || isRemovePending) &&
    Boolean(defaultVideoExternalId) &&
    asset?.uploadStatus === "processing";
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

  const applyUploadedPlayerUrl = (playerUrl: string): void => {
    setAppliedEmbedUrl(playerUrl);
    setLinkDraft(playerUrl);
    setIsRemovePending(false);
    setLinkError(null);
  };

  const manualLinkSlot = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative w-full flex-1">
          <HugeiconsIcon
            className="absolute top-2.5 left-3 text-muted-foreground"
            icon={Link04Icon}
            size={18}
          />
          <Input
            className="w-full pl-10"
            onChange={(event) => {
              setLinkDraft(event.target.value);
              setLinkError(null);
            }}
            placeholder="Cole o link do YouTube, Vimeo ou JMVStream..."
            value={linkDraft}
          />
        </div>
        <Button
          className="w-full shrink-0 sm:w-auto"
          disabled={!linkDraft.trim()}
          onClick={applyManualLink}
          type="button"
        >
          Aplicar link
        </Button>
      </div>
      {linkError && <p className="text-destructive text-xs">{linkError}</p>}
    </div>
  );

  const manualLinkActiveCard = (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all duration-300 ease-out">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <HugeiconsIcon icon={FileLinkIcon} size={20} />
          </div>
          <div className="flex min-w-0 flex-col gap-1 pt-0.5">
            <p className="truncate font-medium text-sm">Link de Vídeo</p>
            <p className="truncate text-muted-foreground text-xs">
              {appliedEmbedUrl}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                className=""
                size="sm"
                type="button"
                variant="destructive"
              >
                <HugeiconsIcon
                  className="mr-1.5 -ml-0.5"
                  icon={Delete02Icon}
                  size={14}
                />
                Remover
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-destructive/10 text-destructive">
                  <HugeiconsIcon icon={Delete02Icon} />
                </AlertDialogMedia>
                <AlertDialogTitle>Remover link</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja remover o link deste vídeo? Esta ação
                  não pode ser desfeita.
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
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-5 rounded-xl border bg-background p-6 shadow-sm">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-base">Vídeo da aula</h3>
        <p className="text-muted-foreground text-sm">
          Adicione o conteúdo em vídeo colando um link externo ou enviando o
          arquivo.
        </p>
      </div>

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

      <JmvstreamUploadPanel
        asset={asset}
        currentVideoHash={defaultVideoExternalId}
        hasManualLinkApplied={hasManualLinkApplied}
        isRemovePending={isRemovePending}
        lessonId={lessonId}
        manualLinkActiveCard={manualLinkActiveCard}
        manualLinkSlot={manualLinkSlot}
        onPlayerReady={applyUploadedPlayerUrl}
        {...(defaultVideoExternalId
          ? { onRemoveVideo: removeVideoLocally }
          : {})}
      />

      <JmvstreamDurationDetector
        defaultEmbedUrl={isRemovePending ? "" : appliedEmbedUrl}
        defaultProvider="jmvstream"
        key={`${isRemovePending ? "removed" : "active"}:${appliedEmbedUrl}`}
        showDetectedMessage={false}
      />

      {previewUrl || isUploadedVideoProcessing ? (
        <div className="pt-4">
          <LessonVideoEditorPreview
            isProcessing={isUploadedVideoProcessing}
            previewUrl={previewUrl}
            title={defaultTitle}
          />
        </div>
      ) : null}
    </div>
  );
}

function getResourceExtension(resource: EditableLessonResource): string | null {
  return getSharedResourceExtension(resource);
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
          className="absolute inset-0 overflow-hidden bg-center bg-cover shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
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
        "absolute inset-0 flex items-center justify-center shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
        tone
      )}
    >
      <HugeiconsIcon icon={Icon} size={22} strokeWidth={2} />
    </div>
  );
}

function formatFileSize(sizeBytes: number): string {
  return formatResourceFileSize(sizeBytes);
}

function getFileTypeLabel(resource: EditableLessonResource): string {
  return getResourceTypeLabel(resource, { presentationLabel: "Apresentação" });
}

export function SortableLessonResourceItem({
  formProps,
  lessonId,
  onRemove,
  onEdit,
  resource,
}: {
  resource: EditableLessonResource;
  lessonId?: string | undefined;
  formProps: Record<string, unknown>;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: resource.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const extension = getResourceExtension(resource);
  const typeLabel = getFileTypeLabel(resource);
  const badgeText = resource.storage === "r2" ? extension : "LINK";

  return (
    <ResourceItem isDragging={isDragging} nodeRef={setNodeRef} style={style}>
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
            value={"url" in resource ? (resource.url as string) : ""}
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
            value={resource.preview ? JSON.stringify(resource.preview) : ""}
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
          <input name="resourceKey[]" type="hidden" value="" {...formProps} />
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

      <input
        name="resourceLabel[]"
        type="hidden"
        value={resource.label}
        {...formProps}
      />
      <input
        name="resourceUrl[]"
        type="hidden"
        value={"url" in resource ? (resource.url as string) : ""}
        {...formProps}
      />

      <ResourceItemDragHandle
        attributes={attributes}
        icon={DragDropVerticalIcon}
        listeners={listeners}
      />
      <ResourceItemVisual>
        <AdminResourceVisual lessonId={lessonId} resource={resource} />
      </ResourceItemVisual>

      <ResourceItemContent>
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 truncate font-medium text-[13px]">
            {resource.label}
          </p>
          {badgeText ? (
            <span className="shrink-0 rounded-md bg-muted/80 px-1.5 py-0.5 font-semibold text-[10px] text-muted-foreground uppercase tracking-normal">
              {badgeText}
            </span>
          ) : null}
        </div>
        {resource.storage === "r2" ? (
          <p className="truncate text-muted-foreground text-xs">
            {typeLabel} &bull; {formatFileSize(resource.sizeBytes ?? 0)}
          </p>
        ) : (
          <p className="truncate text-muted-foreground text-xs">
            {"url" in resource ? resource.url : ""}
          </p>
        )}
      </ResourceItemContent>

      <ResourceItemActions>
        <Button
          aria-label="Editar anexo"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={onEdit}
          size="icon"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon icon={PencilEdit01Icon} size={16} strokeWidth={2} />
        </Button>
        <ResourceDeleteAction onDelete={onRemove} />
      </ResourceItemActions>
    </ResourceItem>
  );
}

function ResourceEditModal({
  resource,
  open,
  onClose,
  onUpdate,
}: {
  resource: EditableLessonResource | undefined;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<EditableLessonResource>) => void;
}) {
  const [editLabel, setEditLabel] = useState("");
  const [editUrl, setEditUrl] = useState("");

  useEffect(() => {
    if (resource && open) {
      setEditLabel(resource.label);
      setEditUrl("url" in resource ? (resource.url as string) : "");
    }
  }, [resource, open]);

  if (!resource) {
    return null;
  }

  return (
    <Dialog onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Anexo</DialogTitle>
          <DialogDescription>
            Altere os detalhes do material anexo a esta aula.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4">
            <div className="flex flex-col gap-2">
              <label className="font-medium text-sm" htmlFor="edit-label">
                Nome do material
              </label>
              <Input
                id="edit-label"
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="Nome do material"
                value={editLabel}
              />
            </div>
            {resource.storage === "external" && (
              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm" htmlFor="edit-url">
                  URL do Link
                </label>
                <Input
                  id="edit-url"
                  onBlur={(e) => {
                    const normalized = normalizeExternalUrl(e.target.value);
                    if (normalized) {
                      setEditUrl(normalized);
                    }
                  }}
                  onChange={(e) => setEditUrl(e.target.value)}
                  placeholder="https://..."
                  type="url"
                  value={editUrl}
                />
              </div>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onUpdate(resource.id, {
                label: editLabel,
                url: editUrl,
              } as Partial<EditableLessonResource>);
              onClose();
            }}
            type="button"
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
    { id: string; file: File }[]
  >([]);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(
    null
  );

  const addResource = (): void => {
    const newResource = createEmptyExternalResource();
    setResources((current) => [...current, newResource]);
    setEditingResourceId(newResource.id);
  };

  const removeResource = (id: string): void => {
    setResources((current) => current.filter((resource) => resource.id !== id));
  };

  const updateResource = (
    id: string,
    updates: Partial<EditableLessonResource>
  ): void => {
    setResources((current) =>
      current.map((resource) =>
        resource.id === id
          ? ({ ...resource, ...updates } as EditableLessonResource)
          : resource
      )
    );
  };

  const uploadResource = async (file: File): Promise<void> => {
    if (!lessonId) {
      toast.error("Salve a aula antes de enviar anexos.");
      return;
    }

    const toastId = toast.loading("Enviando anexo...");
    const tempId = `temp-${Date.now()}`;
    setUploadingFiles((prev) => [...prev, { id: tempId, file }]);

    try {
      const signedUpload = await prepareSignedResourceUpload({
        file,
        lessonId,
      });
      await uploadSignedResource({ file, signedUpload });

      const newResource = toEditableResource(signedUpload.payload.resource);
      if (newResource.storage === "r2" && signedUpload.preview) {
        newResource.localPreviewUrl = URL.createObjectURL(
          signedUpload.preview.blob
        );
      }

      setResources((current) => [...current, newResource]);
      setEditingResourceId(newResource.id);
      setUploadingFiles((prev) => prev.filter((f) => f.id !== tempId));
      toast.success("Anexo enviado. Salve a aula para publicar o material.", {
        id: toastId,
      });
    } catch (error) {
      setUploadingFiles((prev) => prev.filter((f) => f.id !== tempId));
      toast.error(
        error instanceof Error ? error.message : "Nao foi possivel enviar.",
        { id: toastId }
      );
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setResources((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <ResourceListContainer>
      <ResourceEditModal
        onClose={() => setEditingResourceId(null)}
        onUpdate={updateResource}
        open={!!editingResourceId}
        resource={resources.find((r) => r.id === editingResourceId)}
      />
      <ResourceListHeader
        actions={
          <>
            <div className="relative">
              <input
                accept={LESSON_ATTACHMENT_ACCEPT}
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) {
                    uploadResource(file).catch(() => undefined);
                  }
                  event.currentTarget.value = "";
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
          </>
        }
        count={resources.length}
        title="Anexos"
      />

      {resources.length > 0 || uploadingFiles.length > 0 ? (
        <ResourceListBody>
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            sensors={sensors}
          >
            <SortableContext
              items={resources}
              strategy={verticalListSortingStrategy}
            >
              {resources.map((resource) => (
                <SortableLessonResourceItem
                  formProps={formProps}
                  key={resource.id}
                  lessonId={lessonId}
                  onEdit={() => setEditingResourceId(resource.id)}
                  onRemove={() => removeResource(resource.id)}
                  resource={resource}
                />
              ))}
            </SortableContext>
          </DndContext>
          {uploadingFiles.map((f) => (
            <ResourceItemSkeleton key={f.id} />
          ))}
        </ResourceListBody>
      ) : (
        <ResourceDropzoneEmpty />
      )}
    </ResourceListContainer>
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
