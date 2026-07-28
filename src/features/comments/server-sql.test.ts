import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("lesson comments SQL contracts", () => {
  it("stores comments with lesson, author, parent and hidden metadata", async () => {
    const migration = await readFile(
      new URL(
        "../../db/migrations/0020_reconcile_schema_after_manual_changes.sql",
        import.meta.url
      ),
      "utf8"
    );

    expect(migration).toContain("create type lesson_comment_status");
    expect(migration).toContain("create table if not exists lesson_comments");
    expect(migration).toContain(
      "lesson_id uuid not null references lessons(id) on delete cascade"
    );
    expect(migration).toContain(
      "author_user_id text references users(id) on delete set null"
    );
    expect(migration).toContain(
      "parent_id uuid references lesson_comments(id) on delete cascade"
    );
    expect(migration).toContain(
      "hidden_by_user_id text references users(id) on delete set null"
    );
    expect(migration).toContain("lesson_comments_lesson_created_idx");
    expect(migration).toContain("lesson_comments_parent_created_idx");
  });

  it("checks lesson access and prevents nested replies when creating comments", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("ensureCanCommentOnLesson");
    expect(source).toContain(
      "join course_publications cp on cp.id = tl.course_publication_id"
    );
    expect(source).toContain(
      "join modules m on m.course_publication_id = cp.id"
    );
    expect(source).toContain("and l.course_publication_id = cp.id");
    expect(source).toContain(
      "completed_lesson.curriculum_key = l.curriculum_key"
    );
    expect(source).not.toContain(
      "join modules m on m.course_id = tl.course_id"
    );
    expect(source).toContain("e.status = 'active'");
    expect(source).toContain("validateReplyTarget");
    expect(source).toContain("insert into lesson_comments");
  });

  it("filters hidden comments from non-moderators while preserving moderator review", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("const canModerateComments");
    expect(source).toContain("lc.status = 'visible'");
    expect(source).toContain("parent.status = 'visible'");
  });

  it("hides comments without deleting their tree position", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("status = 'hidden'");
    expect(source).toContain("hidden_by_user_id = $2");
    expect(source).toContain("hidden_at = now()");
    expect(source).not.toContain("delete from lesson_comments");
  });

  it("restores hidden comments by clearing moderation metadata", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("restoreLessonComment");
    expect(source).toContain("status = 'visible'");
    expect(source).toContain("hidden_by_user_id = null");
    expect(source).toContain("hidden_at = null");
  });
});
