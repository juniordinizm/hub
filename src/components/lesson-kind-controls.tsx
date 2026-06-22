"use client";

import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
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
          <LessonResourcesFields defaultResources={getResources(content)} />
        </div>
      ) : null}
    </div>
  );
}

function LessonResourcesFields({
  defaultResources,
}: {
  defaultResources: LessonResource[];
}): React.JSX.Element {
  const [resources, setResources] = useState(() =>
    defaultResources.length > 0
      ? defaultResources
      : [{ id: "resource-1", label: "", url: "" }]
  );

  const addResource = (): void => {
    setResources((current) => [
      ...current,
      { id: `resource-${current.length + 1}`, label: "", url: "" },
    ]);
  };

  const removeResource = (id: string): void => {
    setResources((current) =>
      current.length > 1
        ? current.filter((resource) => resource.id !== id)
        : [{ id: "resource-1", label: "", url: "" }]
    );
  };

  return (
    <Field>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel>Materiais da aula</FieldLabel>
        <Button onClick={addResource} size="sm" type="button" variant="outline">
          <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={2} />
          Adicionar
        </Button>
      </div>
      <div className="flex flex-col gap-3">
        {resources.map((resource, index) => (
          <div
            className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]"
            key={resource.id}
          >
            <Input
              defaultValue={resource.label}
              name="resourceLabel[]"
              placeholder="Nome do material"
            />
            <Input
              defaultValue={resource.url}
              name="resourceUrl[]"
              placeholder="https://..."
              type="url"
            />
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
