"use client";

import {
  CheckIcon,
  EraserIcon,
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
  TextStrikethroughIcon,
  UndoIcon,
  Unlink01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  type Editor,
  EditorContent,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useCallback, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
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

interface ToolbarState {
  canBold: boolean;
  canItalic: boolean;
  canRedo: boolean;
  canStrike: boolean;
  canUndo: boolean;
  canUnsetMarks: boolean;
  isBlockquote: boolean;
  isBold: boolean;
  isBulletList: boolean;
  isHeading2: boolean;
  isHeading3: boolean;
  isItalic: boolean;
  isLink: boolean;
  isOrderedList: boolean;
  isParagraph: boolean;
  isStrike: boolean;
}

const emptyToolbarState: ToolbarState = {
  canBold: false,
  canItalic: false,
  canRedo: false,
  canStrike: false,
  canUndo: false,
  canUnsetMarks: false,
  isBlockquote: false,
  isBold: false,
  isBulletList: false,
  isHeading2: false,
  isHeading3: false,
  isItalic: false,
  isLink: false,
  isOrderedList: false,
  isParagraph: false,
  isStrike: false,
};

const whitespacePattern = /\s/;

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
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        "aria-label": "Conteúdo da aula",
        class: "lesson-rich-text-surface",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const nextDocumentJson = JSON.stringify(currentEditor.getJSON());
      queueMicrotask(() => setDocumentJson(nextDocumentJson));
    },
  });

  const toolbarState =
    useEditorState({
      editor,
      selector: ({ editor: currentEditor }) => {
        if (!currentEditor) {
          return emptyToolbarState;
        }

        return {
          canBold: currentEditor.can().chain().focus().toggleBold().run(),
          canItalic: currentEditor.can().chain().focus().toggleItalic().run(),
          canRedo: currentEditor.can().chain().focus().redo().run(),
          canStrike: currentEditor.can().chain().focus().toggleStrike().run(),
          canUndo: currentEditor.can().chain().focus().undo().run(),
          canUnsetMarks: currentEditor
            .can()
            .chain()
            .focus()
            .unsetAllMarks()
            .run(),
          isBlockquote: currentEditor.isActive("blockquote"),
          isBold: currentEditor.isActive("bold"),
          isBulletList: currentEditor.isActive("bulletList"),
          isHeading2: currentEditor.isActive("heading", { level: 2 }),
          isHeading3: currentEditor.isActive("heading", { level: 3 }),
          isItalic: currentEditor.isActive("italic"),
          isLink: currentEditor.isActive("link"),
          isOrderedList: currentEditor.isActive("orderedList"),
          isParagraph: currentEditor.isActive("paragraph"),
          isStrike: currentEditor.isActive("strike"),
        };
      },
    }) ?? emptyToolbarState;

  return (
    <TooltipProvider delayDuration={350}>
      <div className="lesson-rich-text-editor min-w-0 max-w-full overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-ring/30">
        <input name="textDocument" type="hidden" value={documentJson} />
        <EditorToolbar editor={editor} state={toolbarState} />
        {editor ? <EditorBubbleMenu editor={editor} /> : null}
        <div className="lesson-rich-text">
          <EditorContent editor={editor} />
        </div>
      </div>
    </TooltipProvider>
  );
}

function EditorToolbar({
  editor,
  state,
}: {
  editor: Editor | null;
  state: ToolbarState;
}): React.JSX.Element {
  return (
    <div className="border-border/60 border-b bg-card/95">
      <ScrollArea className="w-full">
        <div className="flex min-w-max items-center gap-1 px-2 py-1.5">
          <ToolbarGroup>
            <ToolbarButton
              icon={UndoIcon}
              isDisabled={!state.canUndo}
              label="Desfazer"
              onClick={() => editor?.chain().focus().undo().run()}
            />
            <ToolbarButton
              icon={RedoIcon}
              isDisabled={!state.canRedo}
              label="Refazer"
              onClick={() => editor?.chain().focus().redo().run()}
            />
          </ToolbarGroup>

          <ToolbarSeparator />

          <ToolbarGroup>
            <ToolbarButton
              icon={ParagraphIcon}
              isActive={state.isParagraph}
              label="Parágrafo"
              onClick={() => editor?.chain().focus().setParagraph().run()}
            />
            <ToolbarButton
              icon={Heading2Icon}
              isActive={state.isHeading2}
              label="Título"
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run()
              }
            />
            <ToolbarButton
              icon={Heading03Icon}
              isActive={state.isHeading3}
              label="Subtítulo"
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 3 }).run()
              }
            />
          </ToolbarGroup>

          <ToolbarSeparator />

          <ToolbarGroup>
            <ToolbarButton
              icon={TextBoldIcon}
              isActive={state.isBold}
              isDisabled={!state.canBold}
              label="Negrito"
              onClick={() => editor?.chain().focus().toggleBold().run()}
            />
            <ToolbarButton
              icon={TextItalicIcon}
              isActive={state.isItalic}
              isDisabled={!state.canItalic}
              label="Itálico"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            />
            <ToolbarButton
              icon={TextStrikethroughIcon}
              isActive={state.isStrike}
              isDisabled={!state.canStrike}
              label="Tachado"
              onClick={() => editor?.chain().focus().toggleStrike().run()}
            />
            <ToolbarButton
              icon={EraserIcon}
              isDisabled={!state.canUnsetMarks}
              label="Limpar marcas"
              onClick={() => editor?.chain().focus().unsetAllMarks().run()}
            />
          </ToolbarGroup>

          <ToolbarSeparator />

          <ToolbarGroup>
            <ToolbarButton
              icon={LeftToRightListBulletIcon}
              isActive={state.isBulletList}
              label="Lista"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            />
            <ToolbarButton
              icon={LeftToRightListNumberIcon}
              isActive={state.isOrderedList}
              label="Lista numerada"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            />
            <ToolbarButton
              icon={LeftToRightBlockQuoteIcon}
              isActive={state.isBlockquote}
              label="Citação"
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            />
          </ToolbarGroup>

          <ToolbarSeparator />

          <LinkPopover editor={editor} isActive={state.isLink} />
        </div>
      </ScrollArea>
    </div>
  );
}

function LinkPopover({
  editor,
  isActive,
}: {
  editor: Editor | null;
  isActive: boolean;
}): React.JSX.Element {
  const [linkUrl, setLinkUrl] = useState("");
  const [open, setOpen] = useState(false);
  const inputId = useId();

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

    const normalizedUrl = normalizeLinkUrl(linkUrl);

    if (normalizedUrl) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({
          href: normalizedUrl,
          rel: "noopener noreferrer",
          target: "_blank",
        })
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    }

    setOpen(false);
  }, [editor, linkUrl]);

  const removeLink = useCallback(() => {
    if (!editor) {
      return;
    }

    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkUrl("");
    setOpen(false);
  }, [editor]);

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              aria-label="Inserir link"
              aria-pressed={isActive}
              className={cn(
                isActive && "bg-secondary text-secondary-foreground"
              )}
              disabled={!editor}
              size="icon-sm"
              title="Inserir link"
              type="button"
              variant={isActive ? "secondary" : "ghost"}
            >
              <HugeiconsIcon icon={Link01Icon} size={16} strokeWidth={2} />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Inserir link</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-80 p-3">
        <div className="flex flex-col gap-2.5">
          <label className="font-medium text-sm" htmlFor={inputId}>
            Link
          </label>
          <Input
            aria-label="URL do link"
            className="h-8"
            id={inputId}
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
              <HugeiconsIcon icon={CheckIcon} size={14} strokeWidth={2} />
              Aplicar
            </Button>
            {isActive ? (
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

function EditorBubbleMenu({ editor }: { editor: Editor }): React.JSX.Element {
  const bubbleState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      isBold: currentEditor.isActive("bold"),
      isItalic: currentEditor.isActive("italic"),
      isLink: currentEditor.isActive("link"),
      isStrike: currentEditor.isActive("strike"),
    }),
  }) ?? {
    isBold: false,
    isItalic: false,
    isLink: false,
    isStrike: false,
  };

  return (
    <BubbleMenu
      editor={editor}
      options={{ offset: 8, placement: "top" }}
      shouldShow={({ editor: currentEditor, from, to }) =>
        currentEditor.isEditable && currentEditor.isFocused && from !== to
      }
    >
      <div className="lesson-bubble-menu">
        <BubbleButton
          isActive={bubbleState.isBold}
          label="Negrito"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <HugeiconsIcon icon={TextBoldIcon} size={15} strokeWidth={2} />
        </BubbleButton>
        <BubbleButton
          isActive={bubbleState.isItalic}
          label="Itálico"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <HugeiconsIcon icon={TextItalicIcon} size={15} strokeWidth={2} />
        </BubbleButton>
        <BubbleButton
          isActive={bubbleState.isStrike}
          label="Tachado"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <HugeiconsIcon
            icon={TextStrikethroughIcon}
            size={15}
            strokeWidth={2}
          />
        </BubbleButton>
        {bubbleState.isLink ? (
          <BubbleButton
            isActive={true}
            label="Remover link"
            onClick={() =>
              editor.chain().focus().extendMarkRange("link").unsetLink().run()
            }
          >
            <HugeiconsIcon icon={Unlink01Icon} size={15} strokeWidth={2} />
          </BubbleButton>
        ) : null}
      </div>
    </BubbleMenu>
  );
}

function ToolbarButton({
  icon,
  isActive = false,
  isDisabled = false,
  label,
  onClick,
}: {
  icon: typeof ParagraphIcon;
  isActive?: boolean;
  isDisabled?: boolean;
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          aria-pressed={isActive}
          className={cn(isActive && "bg-secondary text-secondary-foreground")}
          disabled={isDisabled}
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

function ToolbarGroup({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function ToolbarSeparator(): React.JSX.Element {
  return (
    <Separator
      className="mx-0.5 h-6 shrink-0 bg-border/70"
      orientation="vertical"
    />
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
      aria-pressed={isActive}
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

const normalizeLinkUrl = (value: string): string | null => {
  const trimmed = value.trim();

  if (!trimmed || trimmed.includes("\n") || whitespacePattern.test(trimmed)) {
    return null;
  }

  try {
    const url = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`
    );

    if (!(url.protocol === "http:" || url.protocol === "https:")) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
};
