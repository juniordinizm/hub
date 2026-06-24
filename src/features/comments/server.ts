import "server-only";
import { getPool } from "@/db";
import { isLessonAvailable } from "@/features/progress/rules";
import type { AppRole } from "@/lib/session";
import {
  buildLessonCommentTree,
  type LessonCommentRecord,
  type LessonCommentView,
  normalizeCommentBody,
  validateReplyTarget,
} from "./rules";

interface LessonAccessResult {
  courseId: string;
}

interface LessonSequenceRow {
  completed_at: Date | null;
  course_id: string;
  lesson_id: string;
}

interface LessonCommentRow {
  author_id: string | null;
  author_name: string | null;
  author_role: AppRole | null;
  body: string;
  created_at: Date;
  id: string;
  lesson_id: string;
  parent_id: string | null;
  status: "hidden" | "visible";
  updated_at: Date;
}

interface ParentCommentRow {
  id: string;
  lesson_id: string;
  parent_id: string | null;
  status: "hidden" | "visible";
}

export interface LessonCommentsData {
  comments: LessonCommentView[];
  courseId: string;
  totalCount: number;
}

export const ensureCanCommentOnLesson = async ({
  lessonId,
  role,
  userId,
}: {
  lessonId: string;
  role: AppRole;
  userId: string;
}): Promise<LessonAccessResult> => {
  if (role === "admin" || role === "support") {
    const { rows } = await getPool().query<{ course_id: string }>(
      `
        select m.course_id
        from lessons l
        join modules m on m.id = l.module_id
        where l.id = $1
        limit 1
      `,
      [lessonId]
    );
    const courseId = rows[0]?.course_id;

    if (!courseId) {
      throw new Error("Aula invalida.");
    }

    return { courseId };
  }

  const { rows } = await getPool().query<LessonSequenceRow>(
    `
      with target_lesson as (
        select m.course_id
        from lessons l
        join modules m on m.id = l.module_id
        where l.id = $2
        limit 1
      )
      select
        m.course_id,
        l.id as lesson_id,
        lp.completed_at
      from target_lesson tl
      join modules m on m.course_id = tl.course_id and m.status = 'active'
      join lessons l on l.module_id = m.id and l.status = 'active'
      join courses c on c.id = m.course_id
      join enrollments e on e.course_id = m.course_id and e.user_id = $1
      left join lesson_progress lp on lp.lesson_id = l.id and lp.user_id = e.user_id
      where e.status = 'active'
        and e.starts_at <= now()
        and e.expires_at >= now()
        and c.status = 'active'
      order by m.sort_order asc, l.sort_order asc
    `,
    [userId, lessonId]
  );

  if (rows.length === 0) {
    throw new Error("Aula indisponivel para esta matricula.");
  }

  const lessonIds = rows.map((row) => row.lesson_id);
  const completedLessonIds = rows
    .filter((row) => row.completed_at)
    .map((row) => row.lesson_id);

  if (!isLessonAvailable({ lessonIds, completedLessonIds, lessonId })) {
    throw new Error("Aula indisponivel para esta matricula.");
  }

  return { courseId: rows[0]?.course_id ?? "" };
};

export const getLessonComments = async ({
  lessonId,
  role,
  userId,
}: {
  lessonId: string;
  role: AppRole;
  userId: string;
}): Promise<LessonCommentsData> => {
  const { courseId } = await ensureCanCommentOnLesson({
    lessonId,
    role,
    userId,
  });
  const canModerateComments = role === "admin" || role === "support";
  const { rows } = await getPool().query<LessonCommentRow>(
    `
      select
        lc.id,
        lc.lesson_id,
        lc.parent_id,
        lc.body,
        lc.status,
        lc.created_at,
        lc.updated_at,
        u.id as author_id,
        u.name as author_name,
        coalesce(p.role, 'student') as author_role
      from lesson_comments lc
      left join users u on u.id = lc.author_user_id
      left join profiles p on p.user_id = u.id
      where lc.lesson_id = $1
        and (
          $2::boolean
          or (
            lc.status = 'visible'
            and (
              lc.parent_id is null
              or exists (
                select 1
                from lesson_comments parent
                where parent.id = lc.parent_id
                  and parent.status = 'visible'
              )
            )
          )
        )
      order by lc.created_at asc, lc.id asc
    `,
    [lessonId, canModerateComments]
  );

  const records = rows.map(toLessonCommentRecord);

  return {
    comments: buildLessonCommentTree(records),
    courseId,
    totalCount: records.length,
  };
};

export const createLessonComment = async ({
  body,
  lessonId,
  parentId,
  role,
  userId,
}: {
  body: string;
  lessonId: string;
  parentId?: null | string;
  role: AppRole;
  userId: string;
}): Promise<{ commentId: string; courseId: string }> => {
  const normalizedBody = normalizeCommentBody(body);
  const { courseId } = await ensureCanCommentOnLesson({
    lessonId,
    role,
    userId,
  });

  if (parentId) {
    const parent = await getParentComment(parentId);

    if (!parent || parent.status === "hidden") {
      throw new Error("Comentario de origem invalido.");
    }

    validateReplyTarget({
      lessonId,
      parent: {
        id: parent.id,
        lessonId: parent.lesson_id,
        parentId: parent.parent_id,
      },
    });
  }

  const { rows } = await getPool().query<{ id: string }>(
    `
      insert into lesson_comments (
        lesson_id,
        author_user_id,
        parent_id,
        body
      )
      values ($1, $2, $3, $4)
      returning id
    `,
    [lessonId, userId, parentId ?? null, normalizedBody]
  );
  const commentId = rows[0]?.id;

  if (!commentId) {
    throw new Error("Nao foi possivel salvar o comentario.");
  }

  return { commentId, courseId };
};

export const hideLessonComment = async ({
  actorUserId,
  commentId,
}: {
  actorUserId: string;
  commentId: string;
}): Promise<{ courseId: string; lessonId: string }> => {
  const { rows } = await getPool().query<{
    course_id: string;
    lesson_id: string;
  }>(
    `
      update lesson_comments lc
      set status = 'hidden',
          hidden_by_user_id = $2,
          hidden_at = now(),
          updated_at = now()
      from lessons l
      join modules m on m.id = l.module_id
      where lc.id = $1
        and l.id = lc.lesson_id
      returning l.id as lesson_id, m.course_id
    `,
    [commentId, actorUserId]
  );
  const result = rows[0];

  if (!result) {
    throw new Error("Comentario invalido.");
  }

  return {
    courseId: result.course_id,
    lessonId: result.lesson_id,
  };
};

export const restoreLessonComment = async ({
  commentId,
}: {
  commentId: string;
}): Promise<{ courseId: string; lessonId: string }> => {
  const { rows } = await getPool().query<{
    course_id: string;
    lesson_id: string;
  }>(
    `
      update lesson_comments lc
      set status = 'visible',
          hidden_by_user_id = null,
          hidden_at = null,
          updated_at = now()
      from lessons l
      join modules m on m.id = l.module_id
      where lc.id = $1
        and l.id = lc.lesson_id
      returning l.id as lesson_id, m.course_id
    `,
    [commentId]
  );
  const result = rows[0];

  if (!result) {
    throw new Error("Comentario invalido.");
  }

  return {
    courseId: result.course_id,
    lessonId: result.lesson_id,
  };
};

const getParentComment = async (
  commentId: string
): Promise<ParentCommentRow | null> => {
  const { rows } = await getPool().query<ParentCommentRow>(
    `
      select id, lesson_id, parent_id, status
      from lesson_comments
      where id = $1
      limit 1
    `,
    [commentId]
  );

  return rows[0] ?? null;
};

const toLessonCommentRecord = (row: LessonCommentRow): LessonCommentRecord => ({
  id: row.id,
  lessonId: row.lesson_id,
  parentId: row.parent_id,
  body: row.body,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  author: {
    id: row.author_id ?? "deleted-user",
    name: row.author_name ?? "Usuario removido",
    role: row.author_role ?? "student",
  },
});
