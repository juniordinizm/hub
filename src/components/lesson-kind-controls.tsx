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

const lessonTypeOptions = [
  ["video", "Vídeo"],
  ["presentation", "Apresentação"],
  ["bonus", "Bônus"],
] as const;

export function LessonKindControls({
  asset,
  defaultDurationSeconds,
  defaultEmbedUrl,
  defaultLessonType,
  defaultOrder,
  lessonId,
}: {
  asset?: JmvstreamUploadAsset | undefined;
  defaultDurationSeconds: number;
  defaultEmbedUrl: string;
  defaultLessonType: string;
  defaultOrder: number;
  lessonId?: string | undefined;
}): React.JSX.Element {
  const [lessonType, setLessonType] = useState(defaultLessonType || "video");
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
          <FieldLabel>Duração em segundos</FieldLabel>
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
    </div>
  );
}
