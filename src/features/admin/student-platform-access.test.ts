import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("student platform access management", () => {
  it("adds global platform controls to the general students table", async () => {
    const [studentsTableSource, actionMenuSource, sheetSource, platformSource] =
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
            "../../components/admin/student-actions-menu.tsx",
            import.meta.url
          ),
          "utf8"
        ),
        readFile(
          new URL(
            "../../components/admin/student-management-sheet.tsx",
            import.meta.url
          ),
          "utf8"
        ),
        readFile(
          new URL(
            "../../components/admin/student-platform-access-controls.tsx",
            import.meta.url
          ),
          "utf8"
        ),
      ]);

    expect(studentsTableSource).toContain("StudentActionsMenu");
    expect(actionMenuSource).toContain("StudentManagementSheet");
    expect(actionMenuSource).toContain("StudentActionDialog");
    expect(actionMenuSource).toContain("Bloquear acesso da plataforma");
    expect(sheetSource).toContain("StudentPlatformAccessControls");
    expect(platformSource).toContain("Bloquear acesso");
    expect(platformSource).toContain("Restaurar acesso");
    expect(platformSource).toContain("blockStudentPlatformAccessAction");
    expect(platformSource).toContain("restoreStudentPlatformAccessAction");
    expect(studentsTableSource).not.toContain("StudentCoursesSummary");
  });

  it("keeps course-level access controls only inside course enrollment management", async () => {
    const [studentsTableSource, sheetSource, courseTableSource] =
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
            "../../components/admin/student-management-sheet.tsx",
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
    expect(sheetSource).toContain("StudentEnrollmentList");
    expect(courseTableSource).toContain("StudentsTable");
    expect(courseTableSource).toContain("createCourseStudentsTableContext");
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
