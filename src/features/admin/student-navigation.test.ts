import { describe, expect, it } from "vitest";
import {
  getAdminCourseStudentUrl,
  parseAdminCourseStudentAction,
} from "./student-navigation";

describe("admin course student navigation", () => {
  it("opens enrollment details in the selected Course", () => {
    expect(getAdminCourseStudentUrl("course/1", "student-1")).toBe(
      "/admin/cursos/course%2F1?tab=students&enrollmentStudentId=student-1"
    );
  });

  it("opens certificate management in the selected Course", () => {
    expect(
      getAdminCourseStudentUrl("course-1", "student-1", "certificate")
    ).toBe(
      "/admin/cursos/course-1?tab=students&enrollmentStudentId=student-1&enrollmentAction=certificate"
    );
  });

  it("falls back to enrollment details for unknown actions", () => {
    expect(parseAdminCourseStudentAction("unknown")).toBe("details");
  });
});
