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
    expect(source).toContain("resolveLessonAccess");
    expect(source).toContain('access.kind !== "allowed"');
    expect(source).toContain("validateReplyTarget");
    expect(source).toContain("insert into lesson_comments");
  });

  it("revalidates student access on the same transaction that inserts", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    const createSection = source.slice(
      source.indexOf("export const createLessonComment"),
      source.indexOf("export const hideLessonComment")
    );

    expect(createSection).toContain('client.query("BEGIN")');
    expect(createSection).toContain("lockEnrollmentAggregate");
    expect(createSection).toContain("resolveLessonAccessWithClient");
    expect(createSection).toContain("client.query<");
    expect(createSection).toContain('client.query("COMMIT")');
    expect(createSection).toContain("client.release()");
  });

  it("reads comments inside the same entitlement transaction", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );
    const readSection = source.slice(
      source.indexOf("export const getLessonComments"),
      source.indexOf("export const createLessonComment")
    );

    expect(readSection).toContain('client.query("BEGIN")');
    expect(readSection).toContain("ensureCanCommentOnLesson");
    expect(source).toContain("lockEnrollmentAggregate");
    expect(readSection).toContain("client.query<LessonCommentRow>");
    expect(readSection).toContain('client.query("COMMIT")');
  });

  it("filters hidden comments from non-moderators while preserving moderator review", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("const canModerateComments");
    expect(source).toContain('role === "admin"');
    expect(source).not.toContain('role === "admin" || role === "support"');
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
