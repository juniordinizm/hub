import { AspectRatio } from "@/components/ui/aspect-ratio";

export function LessonVideoEditorPreview({
  previewUrl,
  title,
}: {
  previewUrl: null | string;
  title: string;
}): React.JSX.Element {
  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
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
