import { ArrowMoveUpLeftIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type * as React from "react";
import {
  createLessonCommentAction,
  hideLessonCommentAction,
  restoreLessonCommentAction,
} from "@/features/comments/actions";
import type { LessonCommentView } from "@/features/comments/rules";
import type { AppRole } from "@/lib/session";
import { LessonCommentsSubmitButton } from "./lesson-comments-submit-button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { VerifiedBadge } from "./ui/verified-badge";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function LessonCommentsSection({
  canComment,
  canModerate,
  comments,
  context,
  lessonId,
  totalCount,
}: {
  canComment: boolean;
  canModerate: boolean;
  comments: LessonCommentView[];
  context: "admin" | "student";
  lessonId: string;
  totalCount: number;
}): React.JSX.Element {
  return (
    <section className="px-5 py-8 sm:px-8 lg:px-0">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-xl tracking-tight">
              {context === "admin"
                ? "Comentários dos alunos"
                : "Dúvidas e comentários"}
            </h2>
            <Badge variant="outline">
              {totalCount} {totalCount === 1 ? "comentario" : "comentarios"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {context === "admin"
              ? "Gerencie as dúvidas e interações enviadas nesta aula."
              : "Compartilhe duvidas e deixe comentarios nesta aula."}
          </p>
        </div>

        {canComment ? (
          <CommentForm
            context={context}
            label="Novo comentario"
            lessonId={lessonId}
            submitLabel="Comentar"
          />
        ) : (
          <div className="rounded-lg border border-dashed px-4 py-3 text-muted-foreground text-sm">
            Comentarios ficam visiveis, mas o modo de preview nao permite enviar
            novas mensagens.
          </div>
        )}

        {comments.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground text-sm">
            Nenhum comentario ainda. Comece a conversa desta aula.
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {comments.map((comment) => (
              <CommentThread
                canComment={canComment}
                canModerate={canModerate}
                comment={comment}
                context={context}
                key={comment.id}
                lessonId={lessonId}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CommentThread({
  canComment,
  canModerate,
  comment,
  context,
  lessonId,
}: {
  canComment: boolean;
  canModerate: boolean;
  comment: LessonCommentView;
  context: "admin" | "student";
  lessonId: string;
}): React.JSX.Element {
  return (
    <article className="flex gap-3">
      <CommentAvatar authorName={comment.author.name} />
      <div className="min-w-0 flex-1 space-y-3">
        <CommentBody canModerate={canModerate} comment={comment} />

        {comment.replies.length > 0 ? (
          <div className="space-y-3 border-border/60 border-l pl-4">
            {comment.replies.map((reply) => (
              <div className="flex gap-3" key={reply.id}>
                <CommentAvatar authorName={reply.author.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <CommentBody canModerate={canModerate} comment={reply} />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {canComment && !comment.isHidden ? (
          <details className="group/reply">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-muted-foreground text-sm transition hover:text-foreground">
              <HugeiconsIcon
                className="shrink-0"
                icon={ArrowMoveUpLeftIcon}
                size={14}
                strokeWidth={2}
              />
              Responder
            </summary>
            <div className="mt-3">
              <CommentForm
                context={context}
                label={`Responder ${comment.author.name}`}
                lessonId={lessonId}
                parentId={comment.id}
                submitLabel="Responder"
              />
            </div>
          </details>
        ) : null}
      </div>
    </article>
  );
}

function CommentBody({
  canModerate,
  comment,
}: {
  canModerate: boolean;
  comment: LessonCommentView;
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 font-medium text-sm">
          {comment.author.name}
          {(comment.author.role === "admin" ||
            comment.author.role === "support") && (
            <VerifiedBadge
              aria-label="Verificado"
              className="size-[14px] text-blue-500"
            />
          )}
        </span>
        <RoleBadge role={comment.author.role} />
        <span className="text-muted-foreground text-xs">
          {dateFormatter.format(comment.createdAt)}
        </span>
      </div>

      {comment.isHidden ? (
        <div className="space-y-2 rounded-md bg-muted px-3 py-2 text-muted-foreground text-sm">
          <p className="italic">Comentario ocultado da area do aluno.</p>
          {canModerate ? (
            <p className="whitespace-pre-wrap break-words text-xs leading-5">
              {comment.body}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm leading-6">
          {comment.body}
        </p>
      )}

      {canModerate ? (
        <form action={hideLessonCommentAction}>
          <input name="commentId" type="hidden" value={comment.id} />
          {comment.isHidden ? (
            <Button
              formAction={restoreLessonCommentAction}
              size="xs"
              type="submit"
              variant="outline"
            >
              Desocultar
            </Button>
          ) : (
            <Button size="xs" type="submit" variant="ghost">
              Ocultar
            </Button>
          )}
        </form>
      ) : null}
    </div>
  );
}

function CommentForm({
  context,
  label,
  lessonId,
  parentId,
  submitLabel,
}: {
  context: "admin" | "student";
  label: string;
  lessonId: string;
  parentId?: string;
  submitLabel: string;
}): React.JSX.Element {
  return (
    <form action={createLessonCommentAction} className="space-y-3">
      <input name="context" type="hidden" value={context} />
      <input name="lessonId" type="hidden" value={lessonId} />
      {parentId ? (
        <input name="parentId" type="hidden" value={parentId} />
      ) : null}
      <Textarea
        aria-label={label}
        maxLength={2000}
        name="body"
        placeholder="Escreva sua duvida ou complemento..."
        required
        rows={parentId ? 3 : 4}
      />
      <div className="flex justify-end">
        <LessonCommentsSubmitButton pendingLabel="Enviando..." size="sm">
          {submitLabel}
        </LessonCommentsSubmitButton>
      </div>
    </form>
  );
}

function CommentAvatar({
  authorName,
  size = "default",
}: {
  authorName: string;
  size?: "default" | "sm";
}): React.JSX.Element {
  return (
    <Avatar size={size}>
      <AvatarFallback>{getInitials(authorName)}</AvatarFallback>
    </Avatar>
  );
}

function RoleBadge({ role }: { role: AppRole }): React.JSX.Element | null {
  if (role === "student") {
    return null;
  }

  return (
    <Badge variant={role === "admin" ? "default" : "secondary"}>
      {role === "admin" ? "Admin" : "Suporte"}
    </Badge>
  );
}

const WHITESPACE_RE = /\s+/;

const getInitials = (name: string): string => {
  const parts = name.trim().split(WHITESPACE_RE).filter(Boolean);
  const first = parts[0]?.[0] ?? "U";
  const second = parts[1]?.[0] ?? "";

  return `${first}${second}`.toUpperCase();
};
