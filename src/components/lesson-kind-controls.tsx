"use client";

import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { toast } from "sonner";
import { JmvstreamDurationDetector } from "@/components/jmvstream-duration-detector";
import {
  type JmvstreamUploadAsset,
  JmvstreamUploadPanel,
} from "@/components/jmvstream-upload-panel";
import { LessonRichTextEditor } from "@/components/lesson-rich-text-editor";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EMPTY_TEXT_DOCUMENT,
  type LessonContent,
  type LessonResource,
  type ProseMirrorJson,
  parseLessonContent,
} from "@/features/courses/lesson-content";
import {
  LESSON_ATTACHMENT_ACCEPT,
  LESSON_RESOURCE_IMAGE_PREVIEW,
  validateLessonAttachmentUpload,
} from "@/features/storage/r2-objects";

export function LessonKindControls({
  asset,
  defaultContentJson,
  defaultDurationSeconds,
  defaultEmbedUrl,
  defaultOrder,
  lessonId,
}: {
  asset?: JmvstreamUploadAsset | undefined;
  defaultContentJson?: unknown;
  defaultDurationSeconds: number;
  defaultEmbedUrl: string;
  defaultOrder: number;
  lessonId?: string | undefined;
}): React.JSX.Element {
  const content = parseLessonContent(defaultContentJson);

  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-4">
        <Field>
          <FieldLabel>Duracao em segundos</FieldLabel>
          <Input
            defaultValue={defaultDurationSeconds}
            min={0}
            name="durationSeconds"
            step={1}
            type="number"
          />
        </Field>
      </div>
      <input defaultValue={defaultOrder} name="sortOrder" type="hidden" />

      <input name="videoProvider" type="hidden" value="jmvstream" />
      <Tabs className="w-full" defaultValue="upload">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Envio Direto</TabsTrigger>
          <TabsTrigger value="link">Colar Link Manual</TabsTrigger>
        </TabsList>
        <TabsContent className="pt-4" value="upload">
          <JmvstreamUploadPanel
            asset={asset}
            currentVideoHash={null}
            lessonId={lessonId}
          />
        </TabsContent>
        <TabsContent className="pt-4" value="link">
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel>Link ou iframe JMVStream</FieldLabel>
              <Input
                defaultValue={defaultEmbedUrl}
                name="videoEmbedUrl"
                placeholder="https://player.jmvstream.com/... ou iframe oficial"
              />
            </Field>
            <JmvstreamDurationDetector
              defaultEmbedUrl={defaultEmbedUrl}
              defaultProvider="jmvstream"
            />
          </div>
        </TabsContent>
      </Tabs>
      {asset || defaultEmbedUrl ? (
        <label className="flex w-fit items-center gap-2 text-muted-foreground text-sm">
          <input className="size-4" name="removeVideo" type="checkbox" />
          Remover video desta aula
        </label>
      ) : null}

      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel>Conteudo da aula</FieldLabel>
          <LessonRichTextEditor initialDocument={getTextDocument(content)} />
        </Field>
        <LessonResourcesFields
          defaultResources={getResources(content)}
          lessonId={lessonId}
        />
      </div>
    </div>
  );
}

function LessonResourcesFields({
  defaultResources,
  lessonId,
}: {
  defaultResources: LessonResource[];
  lessonId?: string | undefined;
}): React.JSX.Element {
  const [resources, setResources] = useState(() =>
    defaultResources.length > 0
      ? defaultResources.map(toEditableResource)
      : [createEmptyExternalResource()]
  );

  const addResource = (): void => {
    setResources((current) => [...current, createEmptyExternalResource()]);
  };

  const removeResource = (id: string): void => {
    setResources((current) =>
      current.length > 1
        ? current.filter((resource) => resource.id !== id)
        : [createEmptyExternalResource()]
    );
  };

  const uploadResource = async (file: File): Promise<void> => {
    if (!lessonId) {
      toast.error("Salve a aula antes de enviar anexos.");
      return;
    }

    const toastId = toast.loading("Enviando anexo...");

    try {
      const signedUpload = await prepareSignedResourceUpload({
        file,
        lessonId,
      });
      await uploadSignedResource({ file, signedUpload });

      setResources((current) => [
        ...current,
        toEditableResource(signedUpload.payload.resource),
      ]);
      toast.success("Anexo enviado. Salve a aula para publicar o material.", {
        id: toastId,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nao foi possivel enviar.",
        { id: toastId }
      );
    }
  };

  return (
    <Field>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel>Materiais da aula</FieldLabel>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Input
            accept={LESSON_ATTACHMENT_ACCEPT}
            aria-label="Enviar arquivo da aula"
            className="max-w-56"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) {
                uploadResource(file).catch(() => undefined);
              }
            }}
            type="file"
          />
          <Button
            onClick={addResource}
            size="sm"
            type="button"
            variant="outline"
          >
            <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={2} />
            Link
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {resources.map((resource, index) => (
          <div
            className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]"
            key={resource.id}
          >
            <input
              name="resourceStorage[]"
              type="hidden"
              value={resource.storage}
            />
            <Input
              defaultValue={resource.label}
              name="resourceLabel[]"
              placeholder="Nome do material"
            />
            {resource.storage === "r2" ? (
              <div className="flex min-h-9 items-center rounded-md border bg-muted/40 px-3 text-muted-foreground text-sm">
                {resource.fileName}
              </div>
            ) : (
              <Input
                defaultValue={resource.url}
                name="resourceUrl[]"
                placeholder="https://..."
                type="url"
              />
            )}
            {resource.storage === "r2" ? (
              <>
                <input name="resourceUrl[]" type="hidden" value="" />
                <input
                  name="resourceKey[]"
                  type="hidden"
                  value={resource.key}
                />
                <input
                  name="resourceFileName[]"
                  type="hidden"
                  value={resource.fileName}
                />
                <input
                  name="resourceContentType[]"
                  type="hidden"
                  value={resource.contentType}
                />
                <input
                  name="resourcePreview[]"
                  type="hidden"
                  value={
                    resource.preview ? JSON.stringify(resource.preview) : ""
                  }
                />
                <input
                  name="resourceSizeBytes[]"
                  type="hidden"
                  value={resource.sizeBytes}
                />
              </>
            ) : (
              <>
                <input name="resourceKey[]" type="hidden" value="" />
                <input name="resourceFileName[]" type="hidden" value="" />
                <input name="resourceContentType[]" type="hidden" value="" />
                <input name="resourcePreview[]" type="hidden" value="" />
                <input name="resourceSizeBytes[]" type="hidden" value="" />
              </>
            )}
            <Button
              aria-label={`Remover material ${index + 1}`}
              onClick={() => removeResource(resource.id)}
              size="icon"
              title="Remover material"
              type="button"
              variant="ghost"
            >
              <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
            </Button>
          </div>
        ))}
      </div>
    </Field>
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

const getTextDocument = (content: LessonContent | null): ProseMirrorJson => {
  if (content?.type === "text") {
    return content.document;
  }

  return EMPTY_TEXT_DOCUMENT;
};

const getResources = (content: LessonContent | null): LessonResource[] => {
  if (content?.type === "text" && "resources" in content) {
    return content.resources ?? [];
  }

  return [];
};
