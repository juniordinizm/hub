import { AspectRatio } from "@/components/ui/aspect-ratio";
import { sanitizeJmvstreamPlayerUrl } from "@/features/videos/jmvstream";

export function LessonVideoEditorPreview({
  isProcessing = false,
  previewUrl,
  title,
}: {
  isProcessing?: boolean;
  previewUrl: null | string;
  title: string;
}): React.JSX.Element {
  let previewContent: React.JSX.Element;

  const safePreviewUrl = sanitizeJmvstreamPlayerUrl(previewUrl);

  if (safePreviewUrl) {
    previewContent = (
      <iframe
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin"
        src={safePreviewUrl}
        title={`Prévia: ${title}`}
      />
    );
  } else if (isProcessing) {
    previewContent = (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground text-sm">
        <p className="font-medium text-foreground">Vídeo em processamento</p>
        <p className="max-w-md">
          A JMVStream está preparando o player e as qualidades de reprodução. A
          prévia aparece automaticamente quando estiver pronta.
        </p>
      </div>
    );
  } else {
    previewContent = (
      <div className="flex h-full items-center justify-center px-6 text-center text-muted-foreground text-sm">
        Nenhum vídeo selecionado.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="border-border/60 border-b px-3 py-1">
        <h3 className="font-medium text-xs">Prévia do vídeo</h3>
      </div>
      <AspectRatio className="bg-black" ratio={16 / 9}>
        {previewContent}
      </AspectRatio>
    </section>
  );
}
