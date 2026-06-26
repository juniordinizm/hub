import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("student platform access management", () => {
  it("adds global platform controls to the general students table", async () => {
    const source = await readFile(
      new URL(
        "../../app/(admin)/admin/alunos/students-table.tsx",
        import.meta.url
      ),
      "utf8"
    );

    expect(source).toContain("StudentPlatformAccessControls");
    expect(source).toContain("Bloquear na plataforma");
    expect(source).toContain("Restaurar na plataforma");
    expect(source).toContain("StudentCoursesSummary");
    expect(source).toContain("blockStudentPlatformAccessAction");
    expect(source).toContain("restoreStudentPlatformAccessAction");
    expect(source).not.toContain("EnrollmentExpirationControls");
  });

  it("keeps course-level access controls only inside course enrollment management", async () => {
    const [studentsTableSource, studentDetailSource, courseTableSource] =
      await Promise.all([
        readFile(
          new URL(
            "../../app/(admin)/admin/alunos/students-table.tsx",
            import.meta.url
          ),
          "utf8"
        ),
        readFile(
          new URL(
            "../../app/(admin)/admin/alunos/[userId]/page.tsx",
            import.meta.url
          ),
          "utf8"
        ),
        readFile(
          new URL(
            "../../app/(admin)/admin/cursos/[courseId]/course-enrollments-table.tsx",
            import.meta.url
          ),
          "utf8"
        ),
      ]);

    expect(studentsTableSource).not.toContain("EnrollmentExpirationControls");
    expect(studentDetailSource).not.toContain("EnrollmentExpirationControls");
    expect(courseTableSource).toContain("EnrollmentExpirationControls");
  });

  it("persists global platform blocks on the student profile and audits them", async () => {
    const [actionsSource, schemaSource, sessionSource] = await Promise.all([
      readFile(new URL("./actions.ts", import.meta.url), "utf8"),
      readFile(new URL("../../db/schema.ts", import.meta.url), "utf8"),
      readFile(new URL("../../lib/session.ts", import.meta.url), "utf8"),
    ]);

    expect(schemaSource).toContain("platformBlockedAt");
    expect(schemaSource).toContain("platformBlockedReason");
    expect(actionsSource).toContain("student.platform_blocked");
    expect(actionsSource).toContain("student.platform_restored");
    expect(sessionSource).toContain("platformBlockedAt");
    expect(sessionSource).toContain('session.role === "student"');
  });
});
