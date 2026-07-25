import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("public signup profile migration", () => {
  it("backfills absent profiles and creates a student profile for every new user", async () => {
    const migration = await readFile(
      new URL(
        "./migrations/0041_public_signup_student_profiles.sql",
        import.meta.url
      ),
      "utf8"
    );

    expect(migration).toContain("insert into profiles (user_id, role)");
    expect(migration).toContain("from users u");
    expect(migration).toContain("create trigger users_create_student_profile");
    expect(migration).toContain("after insert on users");
    expect(migration).toContain("values (new.id, 'student')");
  });
});
