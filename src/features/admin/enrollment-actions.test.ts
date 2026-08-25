import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("admin enrollment actions", () => {
  it("extends existing paid enrollments instead of creating manual enrollments", async () => {
    const source = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("extendEnrollmentExpirationAction");
    expect(source).toContain("setEnrollmentExpirationAction");
    expect(source).toContain("adjustEnrollmentExpirationAction");
    expect(source).toContain("blockEnrollmentAccessAction");
    expect(source).toContain("restoreEnrollmentAccessAction");
    expect(source).toContain("blockStudentPlatformAccessAction");
    expect(source).toContain("restoreStudentPlatformAccessAction");
    expect(source).toContain("extendEnrollmentExpiration");
    expect(source).toContain('requirePermission("manageEnrollmentSupport")');
    expect(source).toContain('requirePermission("manageEnrollmentAccess")');
    expect(source).not.toContain(
      'rolesForPermission("manageEnrollmentAccess")'
    );
    expect(source).not.toContain("insert into enrollments");
  });
});
