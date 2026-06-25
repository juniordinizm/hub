"use client";

import { useEffect, useRef, useState } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { resolveLessonVideoPreviewUrl } from "@/features/admin/lesson-video-form";

export function LessonVideoEditorPreview({
  defaultEmbedUrl,
  title,
}: {
  defaultEmbedUrl: string;
  title: string;
}): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(() =>
    resolveLessonVideoPreviewUrl({
      savedEmbedUrl: defaultEmbedUrl || null,
      shouldRemoveVideo: false,
      submittedEmbedUrl: null,
    })
  );

  useEffect(() => {
    const form = rootRef.current?.closest("form");

    if (!form) {
      return;
    }

    const syncPreview = () => {
      const formData = new FormData(form);
      setPreviewUrl(
        resolveLessonVideoPreviewUrl({
          savedEmbedUrl: defaultEmbedUrl || null,
          shouldRemoveVideo: formData.get("removeVideo") === "on",
          submittedEmbedUrl: String(formData.get("videoEmbedUrl") ?? ""),
        })
      );
    };

    form.addEventListener("change", syncPreview);
    form.addEventListener("input", syncPreview);
    syncPreview();

    return () => {
      form.removeEventListener("change", syncPreview);
      form.removeEventListener("input", syncPreview);
    };
  }, [defaultEmbedUrl]);

  return (
    <section
      className="overflow-hidden rounded-lg border bg-card shadow-sm"
      ref={rootRef}
    >
      <div className="border-border/60 border-b px-3 py-2">
        <h3 className="font-medium text-sm">Prévia do vídeo</h3>
      </div>
      <AspectRatio className="bg-black" ratio={16 / 9}>
        {previewUrl ? (
          <iframe
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
            referrerPolicy="strict-origin-when-cross-origin"
            src={previewUrl}
            title={`Prévia: ${title}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-muted-foreground text-sm">
            Nenhum vídeo selecionado.
          </div>
        )}
      </AspectRatio>
    </section>
  );
}
