"use client";

import {
  CheckIcon,
  EraserIcon,
  LeftToRightBlockQuoteIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  Link01Icon,
  type ParagraphIcon,
  RedoIcon,
  TextBoldIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  UndoIcon,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  isHeading1: boolean;
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
  isHeading1: false,
  isHeading2: false,
  isHeading3: false,
  isItalic: false,
  isLink: false,
  isOrderedList: false,
  isParagraph: false,
  isStrike: false,
};

const whitespacePattern = /\s/;

const blockFormats = [
  { label: "Parágrafo", value: "paragraph" },
  { label: "Título 1", value: "heading-1" },
  { label: "Título 2", value: "heading-2" },
  { label: "Título 3", value: "heading-3" },
] as const;

type BlockFormatValue = (typeof blockFormats)[number]["value"];
type BlockFormatState = Pick<
  ToolbarState,
  "isHeading1" | "isHeading2" | "isHeading3"
>;

export const getBlockFormatValue = ({
  isHeading1,
  isHeading2,
  isHeading3,
}: BlockFormatState): BlockFormatValue => {
  if (isHeading1) {
    return "heading-1";
  }

  if (isHeading2) {
    return "heading-2";
  }

  if (isHeading3) {
    return "heading-3";
  }

  return "paragraph";
};

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
          isHeading1: currentEditor.isActive("heading", { level: 1 }),
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
        <div className="flex w-full min-w-max items-center gap-1 px-2 py-1.5">
          <ToolbarGroup>
            <BlockFormatSelect editor={editor} state={state} />
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

          <div className="w-4 flex-1" />

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
        </div>
      </ScrollArea>
    </div>
  );
}

function BlockFormatSelect({
  editor,
  state,
}: {
  editor: Editor | null;
  state: BlockFormatState;
}): React.JSX.Element {
  const value = getBlockFormatValue(state);

  const applyBlockFormat = (nextValue: BlockFormatValue) => {
    const command = editor?.chain().focus();

    if (!command) {
      return;
    }

    if (nextValue === "paragraph") {
      command.setParagraph().run();
      return;
    }

    const level = Number(nextValue.replace("heading-", ""));
    command.toggleHeading({ level: level as 1 | 2 | 3 }).run();
  };

  return (
    <Select
      disabled={!editor}
      onValueChange={(nextValue) =>
        applyBlockFormat(nextValue as BlockFormatValue)
      }
      value={value}
    >
      <SelectTrigger
        aria-label="Tipo de bloco"
        className="h-8 w-[8.75rem] bg-transparent"
        size="sm"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        {blockFormats.map((format) => (
          <SelectItem key={format.value} value={format.value}>
            {format.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
            {isActive ? (
              <Button
                onClick={removeLink}
                size="sm"
                type="button"
                variant="destructive"
              >
                Remover
              </Button>
            ) : null}
            <Button
              className="flex-1"
              onClick={applyLink}
              size="sm"
              type="button"
            >
              <HugeiconsIcon icon={CheckIcon} size={14} strokeWidth={2} />
              Aplicar
            </Button>
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
      isBlockquote: currentEditor.isActive("blockquote"),
      isBulletList: currentEditor.isActive("bulletList"),
      isHeading1: currentEditor.isActive("heading", { level: 1 }),
      isHeading2: currentEditor.isActive("heading", { level: 2 }),
      isHeading3: currentEditor.isActive("heading", { level: 3 }),
      isItalic: currentEditor.isActive("italic"),
      isLink: currentEditor.isActive("link"),
      isOrderedList: currentEditor.isActive("orderedList"),
      isParagraph: currentEditor.isActive("paragraph"),
      isStrike: currentEditor.isActive("strike"),
    }),
  }) ?? {
    isBlockquote: false,
    isBold: false,
    isBulletList: false,
    isHeading1: false,
    isHeading2: false,
    isHeading3: false,
    isItalic: false,
    isLink: false,
    isOrderedList: false,
    isParagraph: false,
    isStrike: false,
  };

  return (
    <BubbleMenu
      editor={editor}
      options={{ offset: 8, placement: "bottom" }}
      shouldShow={({ editor: currentEditor, from, to }) =>
        currentEditor.isEditable && currentEditor.isFocused && from !== to
      }
    >
      <div className="lesson-bubble-menu">
        <BlockFormatSelect editor={editor} state={bubbleState} />
        <BubbleSeparator />
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
        <BubbleSeparator />
        <BubbleButton
          isActive={bubbleState.isBulletList}
          label="Lista"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <HugeiconsIcon
            icon={LeftToRightListBulletIcon}
            size={15}
            strokeWidth={2}
          />
        </BubbleButton>
        <BubbleButton
          isActive={bubbleState.isOrderedList}
          label="Lista numerada"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <HugeiconsIcon
            icon={LeftToRightListNumberIcon}
            size={15}
            strokeWidth={2}
          />
        </BubbleButton>
        <BubbleButton
          isActive={bubbleState.isBlockquote}
          label="Citação"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <HugeiconsIcon
            icon={LeftToRightBlockQuoteIcon}
            size={15}
            strokeWidth={2}
          />
        </BubbleButton>
        <BubbleSeparator />
        <LinkPopover editor={editor} isActive={bubbleState.isLink} />
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

function BubbleSeparator(): React.JSX.Element {
  return <span className="mx-0.5 h-5 w-px bg-border/70" />;
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
    <Tooltip>
      <TooltipTrigger asChild>
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
          type="button"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
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
