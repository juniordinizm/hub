import { describe, expect, it } from "vitest";
import { summarizeAdminStudents } from "./students";

describe("admin students summary", () => {
  it("groups multiple enrollments from the same user into one student row", () => {
    const students = summarizeAdminStudents([
      {
        courseTitle: "PROTEA-R",
        email: "aluno@example.com",
        expiresAt: new Date("2027-01-10T00:00:00.000Z"),
        id: "enrollment-1",
        lastAccessAt: new Date("2026-02-01T00:00:00.000Z"),
        name: "Aluno Teste",
        startsAt: new Date("2026-01-10T00:00:00.000Z"),
        status: "active",
        userId: "user-1",
      },
      {
        courseTitle: "Curso Extra",
        email: "aluno@example.com",
        expiresAt: new Date("2027-02-10T00:00:00.000Z"),
        id: "enrollment-2",
        lastAccessAt: new Date("2026-02-01T00:00:00.000Z"),
        name: "Aluno Teste",
        startsAt: new Date("2026-01-05T00:00:00.000Z"),
        status: "expired",
        userId: "user-1",
      },
    ]);

    expect(students).toEqual([
      {
        activeEnrollments: 1,
        courseCount: 2,
        email: "aluno@example.com",
        firstEnrollmentAt: new Date("2026-01-05T00:00:00.000Z"),
        lastAccessAt: new Date("2026-02-01T00:00:00.000Z"),
        latestExpiration: new Date("2027-02-10T00:00:00.000Z"),
        name: "Aluno Teste",
        revokedEnrollments: 0,
        status: "active",
        userId: "user-1",
      },
    ]);
  });
});
