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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createTextDocumentFromPlainText,
  EMPTY_TEXT_DOCUMENT,
  type LessonContent,
  type LessonResource,
  type ProseMirrorJson,
  parseLessonContent,
} from "@/features/courses/lesson-content";
import {
  LESSON_ATTACHMENT_ACCEPT,
  validateLessonAttachmentUpload,
} from "@/features/storage/r2-objects";

const lessonTypeOptions = [
  ["video", "Video"],
  ["text", "Texto"],
] as const;

export function LessonKindControls({
  asset,
  defaultContentJson,
  defaultDurationSeconds,
  defaultEmbedUrl,
  defaultLessonType,
  defaultOrder,
  lessonId,
}: {
  asset?: JmvstreamUploadAsset | undefined;
  defaultContentJson?: unknown;
  defaultDurationSeconds: number;
  defaultEmbedUrl: string;
  defaultLessonType: string;
  defaultOrder: number;
  lessonId?: string | undefined;
}): React.JSX.Element {
  const content = parseLessonContent(defaultContentJson);
  const defaultEditableLessonType =
    defaultLessonType === "video" ? "video" : "text";
  const [lessonType, setLessonType] = useState(defaultEditableLessonType);
  const isVideoLesson = lessonType === "video";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Field>
          <FieldLabel>Tipo</FieldLabel>
          <Select
            defaultValue={lessonType}
            name="lessonType"
            onValueChange={(value) =>
              setLessonType(value === "text" ? "text" : "video")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              {lessonTypeOptions.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
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

      {isVideoLesson ? (
        <>
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
        </>
      ) : null}

      {lessonType === "text" ? (
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
      ) : null}
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
      validateLessonAttachmentUpload({
        contentType: file.type,
        fileName: file.name,
        sizeBytes: file.size,
      });

      const signedResponse = await fetch(
        `/api/admin/lessons/${lessonId}/resources/upload-url`,
        {
          body: JSON.stringify({
            contentType: file.type,
            fileName: file.name,
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

      const uploadResponse = await fetch(signedPayload.uploadUrl, {
        body: file,
        headers: { "Content-Type": file.type },
        method: "PUT",
      });

      if (!uploadResponse.ok) {
        throw new Error("Nao foi possivel enviar o arquivo para o R2.");
      }

      setResources((current) => [
        ...current,
        toEditableResource(signedPayload.resource),
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
      sizeBytes: number;
      storage: "r2";
    };

interface SignedUploadPayload {
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
  if (!isRecord(value) || typeof value.uploadUrl !== "string") {
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

const readUploadError = (value: unknown): string => {
  if (isRecord(value) && typeof value.error === "string") {
    return value.error;
  }

  return "Nao foi possivel preparar o upload.";
};

const getTextDocument = (content: LessonContent | null): ProseMirrorJson => {
  if (content?.type === "text" && "document" in content) {
    return content.document;
  }

  if (content?.type === "text" && "body" in content) {
    return createTextDocumentFromPlainText(content.body);
  }

  return EMPTY_TEXT_DOCUMENT;
};

const getResources = (content: LessonContent | null): LessonResource[] => {
  if (content?.type === "text" && "resources" in content) {
    return content.resources ?? [];
  }

  return [];
};
