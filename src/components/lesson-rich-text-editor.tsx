"use client";

import {
  Heading2Icon,
  Heading03Icon,
  LeftToRightBlockQuoteIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  Link01Icon,
  ParagraphIcon,
  RedoIcon,
  TextBoldIcon,
  TextItalicIcon,
  UndoIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { EditorContent, useEditor } from "@tiptap/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProseMirrorJson } from "@/features/courses/lesson-content";
import { richTextExtensions } from "@/features/courses/rich-text-extensions";
import { cn } from "@/lib/utils";

interface LessonRichTextEditorProps {
  initialDocument: ProseMirrorJson;
}

export function LessonRichTextEditor({
  initialDocument,
}: LessonRichTextEditorProps): React.JSX.Element {
  const [documentJson, setDocumentJson] = useState(() =>
    JSON.stringify(initialDocument)
  );
  const [linkUrl, setLinkUrl] = useState("");
  const editor = useEditor({
    extensions: richTextExtensions,
    content: initialDocument,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      const nextDocument = currentEditor.getJSON();
      setDocumentJson(JSON.stringify(nextDocument));
    },
  });

  const runCommand = (command: () => void): void => {
    command();
    const nextDocument = editor?.getJSON() ?? initialDocument;
    setDocumentJson(JSON.stringify(nextDocument));
  };

  const applyLink = (): void => {
    if (!editor) {
      return;
    }

    const normalizedUrl = linkUrl.trim();

    runCommand(() => {
      if (!normalizedUrl) {
        editor.chain().focus().unsetLink().run();
        return;
      }

      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({
          href: normalizedUrl,
          target: "_blank",
          rel: "noopener",
        })
        .run();
    });
  };

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-lg border bg-card shadow-sm">
      <input name="textDocument" type="hidden" value={documentJson} />
      <div className="flex min-w-0 flex-wrap items-center gap-1 border-border/60 border-b p-2">
        <ToolbarButton
          isActive={editor?.isActive("paragraph") ?? false}
          label="Paragrafo"
          onClick={() =>
            runCommand(() => editor?.chain().focus().setParagraph().run())
          }
        >
          <HugeiconsIcon icon={ParagraphIcon} size={16} strokeWidth={2} />
        </ToolbarButton>
        <ToolbarButton
          isActive={editor?.isActive("heading", { level: 2 }) ?? false}
          label="Titulo"
          onClick={() =>
            runCommand(() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            )
          }
        >
          <HugeiconsIcon icon={Heading2Icon} size={16} strokeWidth={2} />
        </ToolbarButton>
        <ToolbarButton
          isActive={editor?.isActive("heading", { level: 3 }) ?? false}
          label="Subtitulo"
          onClick={() =>
            runCommand(() =>
              editor?.chain().focus().toggleHeading({ level: 3 }).run()
            )
          }
        >
          <HugeiconsIcon icon={Heading03Icon} size={16} strokeWidth={2} />
        </ToolbarButton>
        <ToolbarButton
          isActive={editor?.isActive("bold") ?? false}
          label="Negrito"
          onClick={() =>
            runCommand(() => editor?.chain().focus().toggleBold().run())
          }
        >
          <HugeiconsIcon icon={TextBoldIcon} size={16} strokeWidth={2} />
        </ToolbarButton>
        <ToolbarButton
          isActive={editor?.isActive("italic") ?? false}
          label="Italico"
          onClick={() =>
            runCommand(() => editor?.chain().focus().toggleItalic().run())
          }
        >
          <HugeiconsIcon icon={TextItalicIcon} size={16} strokeWidth={2} />
        </ToolbarButton>
        <ToolbarButton
          isActive={editor?.isActive("bulletList") ?? false}
          label="Lista"
          onClick={() =>
            runCommand(() => editor?.chain().focus().toggleBulletList().run())
          }
        >
          <HugeiconsIcon
            icon={LeftToRightListBulletIcon}
            size={16}
            strokeWidth={2}
          />
        </ToolbarButton>
        <ToolbarButton
          isActive={editor?.isActive("orderedList") ?? false}
          label="Lista numerada"
          onClick={() =>
            runCommand(() => editor?.chain().focus().toggleOrderedList().run())
          }
        >
          <HugeiconsIcon
            icon={LeftToRightListNumberIcon}
            size={16}
            strokeWidth={2}
          />
        </ToolbarButton>
        <ToolbarButton
          isActive={editor?.isActive("blockquote") ?? false}
          label="Citacao"
          onClick={() =>
            runCommand(() => editor?.chain().focus().toggleBlockquote().run())
          }
        >
          <HugeiconsIcon
            icon={LeftToRightBlockQuoteIcon}
            size={16}
            strokeWidth={2}
          />
        </ToolbarButton>
        <ToolbarButton
          label="Desfazer"
          onClick={() => runCommand(() => editor?.chain().focus().undo().run())}
        >
          <HugeiconsIcon icon={UndoIcon} size={16} strokeWidth={2} />
        </ToolbarButton>
        <ToolbarButton
          label="Refazer"
          onClick={() => runCommand(() => editor?.chain().focus().redo().run())}
        >
          <HugeiconsIcon icon={RedoIcon} size={16} strokeWidth={2} />
        </ToolbarButton>
        <div className="flex min-w-0 basis-full items-center gap-1 sm:ml-auto sm:min-w-56 sm:flex-1 sm:basis-56">
          <Input
            aria-label="URL do link"
            className="h-8 min-w-0"
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://..."
            type="url"
            value={linkUrl}
          />
          <Button
            aria-label="Aplicar link"
            onClick={applyLink}
            size="icon-sm"
            title="Aplicar link"
            type="button"
            variant={editor?.isActive("link") ? "secondary" : "outline"}
          >
            <HugeiconsIcon icon={Link01Icon} size={16} strokeWidth={2} />
          </Button>
        </div>
      </div>
      <EditorContent
        className="min-h-64 min-w-0 px-4 py-3 text-base leading-7 outline-none [&_.ProseMirror]:min-h-56 [&_.ProseMirror]:break-words [&_.ProseMirror]:outline-none [&_.ProseMirror]:[overflow-wrap:anywhere] [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_h2]:font-semibold [&_h2]:text-2xl [&_h3]:font-semibold [&_h3]:text-xl [&_ol]:ml-6 [&_ol]:list-decimal [&_p]:my-3 [&_ul]:ml-6 [&_ul]:list-disc"
        editor={editor}
      />
    </div>
  );
}

function ToolbarButton({
  children,
  isActive = false,
  label,
  onClick,
}: {
  children: React.ReactNode;
  isActive?: boolean;
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <Button
      aria-label={label}
      className={cn(isActive && "bg-secondary text-secondary-foreground")}
      onClick={onClick}
      size="icon-sm"
      title={label}
      type="button"
      variant={isActive ? "secondary" : "ghost"}
    >
      {children}
    </Button>
  );
}
