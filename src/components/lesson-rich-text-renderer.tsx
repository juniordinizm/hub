import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import type { ProseMirrorJson } from "@/features/courses/lesson-content";
import { richTextExtensions } from "@/features/courses/rich-text-extensions";

export function LessonRichTextRenderer({
  document,
}: {
  document: ProseMirrorJson;
}): React.JSX.Element {
  return (
    <div className="lesson-rich-text">
      {renderToReactElement({
        extensions: richTextExtensions,
        content: document,
      })}
    </div>
  );
}
