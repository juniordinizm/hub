import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stagedLessonResourceUploads } from "./schema";

describe("lesson resource upload schema", () => {
  it("declares the session table and its immutable upload metadata", () => {
    expect(stagedLessonResourceUploads).toBeDefined();

    const migration = readFileSync(
      new URL(
        "./migrations/0068_staged_lesson_resource_uploads.sql",
        import.meta.url
      ),
      "utf8"
    );

    expect(migration).toContain(
      'CREATE TABLE "staged_lesson_resource_uploads"'
    );
    expect(migration).toContain('"lesson_id" uuid NOT NULL');
    expect(migration).toContain('"actor_user_id" text NOT NULL');
    expect(migration).toContain('"object_key" text NOT NULL');
    expect(migration).toContain("expires_at");
  });
});
