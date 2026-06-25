"use client";

import {
  Heading2Icon,
  Heading03Icon,
  LeftToRightBlockQuoteIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  Link01Icon,
  LinkSquare02Icon,
  ParagraphIcon,
  RedoIcon,
  TextBoldIcon,
  TextItalicIcon,
  UndoIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProseMirrorJson } from "@/features/courses/lesson-content";
import { editorExtensions } from "@/features/courses/rich-text-extensions";
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

  const editor = useEditor({
    extensions: editorExtensions,
    content: initialDocument,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      const nextDocument = currentEditor.getJSON();
      setDocumentJson(JSON.stringify(nextDocument));
    },
  });

  return (
    <TooltipProvider delayDuration={400}>
      <div className="lesson-rich-text-editor min-w-0 max-w-full overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-ring/30">
        <input name="textDocument" type="hidden" value={documentJson} />

        {/* Toolbar */}
        <EditorToolbar editor={editor} />

        {/* BubbleMenu */}
        {editor ? <EditorBubbleMenu editor={editor} /> : null}

        {/* Editor Content */}
        <div className="lesson-rich-text">
          <EditorContent editor={editor} />
        </div>
      </div>
    </TooltipProvider>
  );
}

/* ------------------------------------------------------------------ */
/* Toolbar                                                             */
/* ------------------------------------------------------------------ */

function EditorToolbar({
  editor,
}: {
  editor: Editor | null;
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-0.5 border-border/60 border-b px-1.5 py-1.5">
      {/* Grupo: Tipo de bloco */}
      <ToolbarButton
        icon={ParagraphIcon}
        isActive={editor?.isActive("paragraph") ?? false}
        label="Paragrafo"
        onClick={() => editor?.chain().focus().setParagraph().run()}
      />
      <ToolbarButton
        icon={Heading2Icon}
        isActive={editor?.isActive("heading", { level: 2 }) ?? false}
        label="Titulo"
        onClick={() =>
          editor?.chain().focus().toggleHeading({ level: 2 }).run()
        }
      />
      <ToolbarButton
        icon={Heading03Icon}
        isActive={editor?.isActive("heading", { level: 3 }) ?? false}
        label="Subtitulo"
        onClick={() =>
          editor?.chain().focus().toggleHeading({ level: 3 }).run()
        }
      />

      <Separator className="mx-0.5 h-5" orientation="vertical" />

      {/* Grupo: Formatação inline */}
      <ToolbarButton
        icon={TextBoldIcon}
        isActive={editor?.isActive("bold") ?? false}
        label="Negrito"
        onClick={() => editor?.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={TextItalicIcon}
        isActive={editor?.isActive("italic") ?? false}
        label="Italico"
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      />

      <Separator className="mx-0.5 h-5" orientation="vertical" />

      {/* Grupo: Listas & Citação */}
      <ToolbarButton
        icon={LeftToRightListBulletIcon}
        isActive={editor?.isActive("bulletList") ?? false}
        label="Lista"
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={LeftToRightListNumberIcon}
        isActive={editor?.isActive("orderedList") ?? false}
        label="Lista numerada"
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon={LeftToRightBlockQuoteIcon}
        isActive={editor?.isActive("blockquote") ?? false}
        label="Citacao"
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
      />

      <Separator className="mx-0.5 h-5" orientation="vertical" />

      {/* Grupo: Undo / Redo */}
      <ToolbarButton
        icon={UndoIcon}
        label="Desfazer"
        onClick={() => editor?.chain().focus().undo().run()}
      />
      <ToolbarButton
        icon={RedoIcon}
        label="Refazer"
        onClick={() => editor?.chain().focus().redo().run()}
      />

      {/* Grupo: Link (popover) — alinhado à direita */}
      <div className="ml-auto">
        <LinkPopover editor={editor} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Link Popover                                                        */
/* ------------------------------------------------------------------ */

function LinkPopover({ editor }: { editor: Editor | null }): React.JSX.Element {
  const [linkUrl, setLinkUrl] = useState("");
  const [open, setOpen] = useState(false);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen && editor) {
        const existingHref = editor.getAttributes("link").href as
          | string
          | undefined;
        setLinkUrl(existingHref ?? "");
      }
      setOpen(nextOpen);
    },
    [editor]
  );

  const applyLink = useCallback(() => {
    if (!editor) {
      return;
    }

    const normalizedUrl = linkUrl.trim();

    if (normalizedUrl) {
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
    } else {
      editor.chain().focus().unsetLink().run();
    }

    setOpen(false);
  }, [editor, linkUrl]);

  const removeLink = useCallback(() => {
    if (!editor) {
      return;
    }

    editor.chain().focus().unsetLink().run();
    setLinkUrl("");
    setOpen(false);
  }, [editor]);

  const isLinkActive = editor?.isActive("link") ?? false;

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              aria-label="Inserir link"
              className={cn(
                isLinkActive && "bg-secondary text-secondary-foreground"
              )}
              size="icon-sm"
              title="Inserir link"
              type="button"
              variant={isLinkActive ? "secondary" : "ghost"}
            >
              <HugeiconsIcon icon={Link01Icon} size={16} strokeWidth={2} />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Inserir link</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-80 p-3">
        <div className="flex flex-col gap-2.5">
          <p className="font-medium text-sm">Link</p>
          <Input
            aria-label="URL do link"
            className="h-8"
            onChange={(event) => setLinkUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink();
              }
            }}
            placeholder="https://..."
            type="url"
            value={linkUrl}
          />
          <div className="flex items-center gap-1.5">
            <Button
              className="flex-1"
              onClick={applyLink}
              size="sm"
              type="button"
            >
              Aplicar
            </Button>
            {isLinkActive ? (
              <Button
                onClick={removeLink}
                size="sm"
                type="button"
                variant="ghost"
              >
                Remover
              </Button>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Bubble Menu                                                         */
/* ------------------------------------------------------------------ */

function EditorBubbleMenu({ editor }: { editor: Editor }): React.JSX.Element {
  return (
    <BubbleMenu editor={editor}>
      <div className="lesson-bubble-menu">
        <BubbleButton
          isActive={editor.isActive("bold")}
          label="Negrito"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <HugeiconsIcon icon={TextBoldIcon} size={15} strokeWidth={2} />
        </BubbleButton>
        <BubbleButton
          isActive={editor.isActive("italic")}
          label="Italico"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <HugeiconsIcon icon={TextItalicIcon} size={15} strokeWidth={2} />
        </BubbleButton>
        <BubbleButton
          isActive={editor.isActive("link")}
          label="Link"
          onClick={() => {
            if (editor.isActive("link")) {
              editor.chain().focus().unsetLink().run();
            } else {
              const url = editor.getAttributes("link").href as
                | string
                | undefined;
              editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({
                  href: url || "",
                  target: "_blank",
                  rel: "noopener",
                })
                .run();
            }
          }}
        >
          <HugeiconsIcon icon={LinkSquare02Icon} size={15} strokeWidth={2} />
        </BubbleButton>
      </div>
    </BubbleMenu>
  );
}

/* ------------------------------------------------------------------ */
/* Shared toolbar button                                               */
/* ------------------------------------------------------------------ */

function ToolbarButton({
  icon,
  isActive = false,
  label,
  onClick,
}: {
  icon: typeof ParagraphIcon;
  isActive?: boolean;
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          className={cn(isActive && "bg-secondary text-secondary-foreground")}
          onClick={onClick}
          size="icon-sm"
          title={label}
          type="button"
          variant={isActive ? "secondary" : "ghost"}
        >
          <HugeiconsIcon icon={icon} size={16} strokeWidth={2} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function BubbleButton({
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
    <button
      aria-label={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-md transition-colors duration-100",
        isActive
          ? "bg-secondary text-secondary-foreground"
          : "text-popover-foreground hover:bg-muted"
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}
