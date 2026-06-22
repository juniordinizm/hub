"use client";

import { useState } from "react";
import { JmvstreamDurationDetector } from "@/components/jmvstream-duration-detector";
import {
  type JmvstreamUploadAsset,
  JmvstreamUploadPanel,
} from "@/components/jmvstream-upload-panel";
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
import { Textarea } from "@/components/ui/textarea";
import {
  type LessonContent,
  parseLessonContent,
} from "@/features/courses/lesson-content";

const lessonTypeOptions = [
  ["video", "Video"],
  ["presentation", "Apresentacao"],
  ["text", "Texto"],
  ["bonus", "Bonus"],
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
  const [lessonType, setLessonType] = useState(defaultLessonType || "video");
  const content = parseLessonContent(defaultContentJson);
  const isVideoLesson = lessonType === "video";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Field>
          <FieldLabel>Tipo</FieldLabel>
          <Select
            defaultValue={lessonType}
            name="lessonType"
            onValueChange={setLessonType}
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

      {lessonType === "presentation" ? (
        <Field>
          <FieldLabel>Link da apresentacao ou PDF</FieldLabel>
          <Input
            defaultValue={getPresentationUrl(content)}
            name="presentationUrl"
            placeholder="https://..."
            type="url"
          />
        </Field>
      ) : null}

      {lessonType === "text" ? (
        <Field>
          <FieldLabel>Conteudo da aula</FieldLabel>
          <Textarea
            defaultValue={getTextBody(content)}
            name="textBody"
            placeholder="Escreva o conteudo textual da aula..."
            rows={10}
          />
        </Field>
      ) : null}

      {lessonType === "bonus" ? (
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Conteudo do bonus</FieldLabel>
            <Textarea
              defaultValue={getBonusBody(content)}
              name="bonusBody"
              placeholder="Descreva o material bonus, instrucoes ou proximos passos..."
              rows={8}
            />
          </Field>
          <Field>
            <FieldLabel>Link opcional do material</FieldLabel>
            <Input
              defaultValue={getBonusUrl(content)}
              name="bonusUrl"
              placeholder="https://..."
              type="url"
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

const getPresentationUrl = (content: LessonContent | null): string =>
  content?.type === "presentation" ? content.url : "";

const getTextBody = (content: LessonContent | null): string =>
  content?.type === "text" ? content.body : "";

const getBonusBody = (content: LessonContent | null): string =>
  content?.type === "bonus" ? content.body : "";

const getBonusUrl = (content: LessonContent | null): string =>
  content?.type === "bonus" ? (content.url ?? "") : "";
