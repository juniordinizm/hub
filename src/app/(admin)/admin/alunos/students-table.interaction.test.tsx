// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/features/admin/actions", () => ({
  adjustEnrollmentExpirationAction: vi.fn(),
  blockEnrollmentAccessAction: vi.fn(),
  blockStudentPlatformAccessAction: vi.fn(),
  restoreEnrollmentAccessAction: vi.fn(),
  restoreStudentPlatformAccessAction: vi.fn(),
}));
vi.mock("@/features/certificates/actions", () => ({
  issueManualCertificateAction: vi.fn(),
  reissueCertificateAction: vi.fn(),
  revokeCertificateAction: vi.fn(),
}));

import { StudentsTable, type StudentTableRow } from "./students-table";
import {
  createCourseStudentsTableContext,
  createGlobalStudentsTableContext,
} from "./students-table-context";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const student: StudentTableRow = {
  email: "student@example.test",
  lastAccessAt: null,
  name: "Student",
  platformBlockedAt: null,
  platformBlockedReason: null,
  status: "active",
  userId: "student-1",
};

const createStudentPayload = (courseId: string | null) => ({
  certificates: [],
  context: {
    courseId,
    courseTitle: courseId ? "Curso 1" : null,
  },
  student: {
    email: student.email,
    enrollments: courseId
      ? [
          {
            courseId,
            courseTitle: "Curso 1",
            expiresAt: "2027-01-01T00:00:00.000Z",
            id: "enrollment-1",
            originalExpiresAt: "2027-01-01T00:00:00.000Z",
            revokedReason: null,
            startedAt: "2026-01-01T00:00:00.000Z",
            status: "active",
            userId: student.userId,
          },
        ]
      : [],
    name: student.name,
    platformBlockedAt: null,
    platformBlockedReason: null,
    userId: student.userId,
  },
});

let root: Root | null = null;
let container: HTMLDivElement;

const clickActionMenu = async (): Promise<void> => {
  await act(async () => {
    const trigger = document.querySelector(
      'button[aria-label="Ações de Student"]'
    ) as HTMLButtonElement | null;
    trigger?.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, button: 0 })
    );
    trigger?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
  vi.restoreAllMocks();
});

describe("StudentsTable action scope", () => {
  it("keeps the global menu limited to platform access", async () => {
    root = createRoot(container);
    act(() => {
      root?.render(
        <StudentsTable
          context={createGlobalStudentsTableContext()}
          students={[student]}
        />
      );
    });

    await clickActionMenu();

    expect(document.body.textContent).toContain("Ver detalhes");
    expect(document.body.textContent).toContain("Bloquear acesso");
    expect(document.body.textContent).not.toContain("Gerenciar matrícula");
    expect(document.body.textContent).not.toContain("Gerenciar certificados");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createStudentPayload(null)), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    await act(async () => {
      const platformAction = [
        ...document.querySelectorAll('[role="menuitem"]'),
      ].find((item) => item.textContent?.includes("Bloquear acesso"));
      (platformAction as HTMLElement | undefined)?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Acesso na plataforma");
    expect(document.body.textContent).toContain(
      "Bloquear acesso da plataforma"
    );
    expect(document.body.textContent).toContain("Motivo do bloqueio");
    expect(document.querySelector("[data-platform-access-form]")).toBeNull();
    expect(
      consoleError.mock.calls.some(([message]) =>
        String(message).includes("value prop on input should not be null")
      )
    ).toBe(false);
    consoleError.mockRestore();
  });

  it("opens global details separately from platform actions", async () => {
    root = createRoot(container);
    act(() => {
      root?.render(
        <StudentsTable
          context={createGlobalStudentsTableContext()}
          students={[student]}
        />
      );
    });

    await clickActionMenu();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createStudentPayload(null)), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      const detailsAction = [
        ...document.querySelectorAll('[role="menuitem"]'),
      ].find((item) => item.textContent?.includes("Ver detalhes"));
      (detailsAction as HTMLElement | undefined)?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/students/student-1",
      expect.objectContaining({ cache: "no-store" })
    );
    expect(document.body.textContent).toContain("Cursos do Aluno");
    expect(document.body.textContent).not.toContain(
      "Bloquear acesso da plataforma"
    );
    expect(document.body.textContent).not.toContain("Ações da Matrícula");
  });

  it("keeps the course menu limited to enrollment and certificate actions", async () => {
    root = createRoot(container);
    act(() => {
      root?.render(
        <StudentsTable
          context={createCourseStudentsTableContext("course-1")}
          students={[student]}
        />
      );
    });

    await clickActionMenu();

    expect(document.body.textContent).toContain("Ver detalhes");
    expect(document.body.textContent).toContain("Gerenciar matrícula");
    expect(document.body.textContent).toContain("Gerenciar certificados");
    expect(document.body.textContent).not.toContain("Bloquear acesso");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createStudentPayload("course-1")), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => {
      const enrollmentAction = [
        ...document.querySelectorAll('[role="menuitem"]'),
      ].find((item) => item.textContent?.includes("Gerenciar matrícula"));
      (enrollmentAction as HTMLElement | undefined)?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/students/student-1?courseId=course-1",
      expect.objectContaining({ cache: "no-store" })
    );
    expect(document.body.textContent).toContain("Ações da Matrícula");
    expect(document.body.textContent).toContain("Ajustar validade");
    expect(document.body.textContent).toContain("Bloquear acesso ao Curso");
    expect(
      document.body.textContent?.match(/Expiração original/g)
    ).toHaveLength(1);
    expect(document.body.textContent).not.toContain("Acesso na plataforma");
  });

  it("opens the selected course enrollment after contextual navigation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createStudentPayload("course-1")), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    root = createRoot(container);
    act(() => {
      root?.render(
        <StudentsTable
          context={createCourseStudentsTableContext("course-1")}
          initialStudentId="student-1"
          students={[student]}
        />
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/students/student-1?courseId=course-1",
      expect.objectContaining({ cache: "no-store" })
    );
    expect(document.body.textContent).toContain("Detalhes da matrícula");
    expect(document.body.textContent).not.toContain("Ações da Matrícula");
  });
});
