import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import type { ProseMirrorJson } from "@/features/courses/lesson-content";
import { rendererExtensions } from "@/features/courses/rich-text-extensions";

export function LessonRichTextRenderer({
  document,
}: {
  document: ProseMirrorJson;
}): React.JSX.Element {
  return (
    <div className="lesson-rich-text">
      {renderToReactElement({
        extensions: rendererExtensions,
        content: document,
      })}
    </div>
  );
}
