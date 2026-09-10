import { describe, expect, it } from "vitest";
import { summarizeAdminStudents } from "./students";

describe("admin students summary", () => {
  it("includes student profiles without enrollments", () => {
    const students = summarizeAdminStudents(
      [],
      [
        {
          email: "aluno@example.com",
          lastAccessAt: null,
          name: "Aluno Sem Curso",
          platformBlockedAt: null,
          platformBlockedReason: null,
          userId: "user-1",
        },
      ]
    );

    expect(students).toEqual([
      {
        activeEnrollments: 0,
        courseCount: 0,
        email: "aluno@example.com",
        firstEnrollmentAt: null,
        lastAccessAt: null,
        latestExpiration: null,
        name: "Aluno Sem Curso",
        nextExpiration: null,
        platformBlockedAt: null,
        platformBlockedReason: null,
        revokedEnrollments: 0,
        status: "not_enrolled",
        userId: "user-1",
      },
    ]);
  });

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
        nextExpiration: new Date("2027-01-10T00:00:00.000Z"),
        platformBlockedAt: null,
        platformBlockedReason: null,
        revokedEnrollments: 0,
        status: "active",
        userId: "user-1",
      },
    ]);
  });

  it("uses effective access projections when they are available", () => {
    const students = summarizeAdminStudents(
      [
        {
          courseTitle: "Curso arquivado",
          email: "aluno@example.com",
          expiresAt: new Date("2027-01-10T00:00:00.000Z"),
          id: "enrollment-1",
          lastAccessAt: null,
          name: "Aluno Teste",
          startsAt: new Date("2026-01-10T00:00:00.000Z"),
          status: "active",
          userId: "user-1",
        },
      ],
      [
        {
          email: "aluno@example.com",
          lastAccessAt: null,
          name: "Aluno Teste",
          platformBlockedAt: null,
          platformBlockedReason: null,
          userId: "user-1",
        },
      ],
      new Map([
        [
          "user-1",
          {
            activeEnrollments: 0,
            nextExpiration: null,
          },
        ],
      ])
    );

    expect(students[0]).toMatchObject({
      activeEnrollments: 0,
      nextExpiration: null,
      status: "inactive",
    });
  });
});
