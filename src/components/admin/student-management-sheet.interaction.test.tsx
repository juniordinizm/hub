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

import { StudentManagementSheet } from "./student-management-sheet";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement;

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

describe("StudentManagementSheet interaction states", () => {
  it("uses an explicit contextual endpoint when support opens the sheet", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          certificates: [],
          context: { courseId: "course-1", courseTitle: "Curso 1" },
          student: {
            email: "student@example.test",
            enrollments: [],
            name: "Student",
            platformBlockedAt: null,
            platformBlockedReason: null,
            userId: "student-1",
          },
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    root = createRoot(container);
    act(() => {
      root?.render(
        <StudentManagementSheet
          capabilities={{
            canManageCertificates: false,
            canManageEnrollmentSupport: true,
            canManagePlatformAccess: false,
            canReissueCertificates: true,
          }}
          courseId="course-1"
          dataUrl="/api/admin/operations/courses/course-1/students/student-1"
          trigger={<button type="button">Consultar</button>}
          userId="student-1"
        />
      );
    });

    await act(async () => {
      container.querySelector("button")?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/operations/courses/course-1/students/student-1",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("shows skeleton, inline retry, and content after a successful retry", async () => {
    let releaseFirstRequest: (response: Response) => void = () => undefined;
    const firstRequest = new Promise<Response>((resolve) => {
      releaseFirstRequest = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            certificates: [],
            context: { courseId: null, courseTitle: null },
            student: {
              email: "student@example.test",
              enrollments: [
                {
                  courseId: "course-1",
                  courseTitle: "Curso 1",
                  expiresAt: "2026-12-01T00:00:00.000Z",
                  id: "enrollment-1",
                  originalExpiresAt: "2026-12-01T00:00:00.000Z",
                  revokedReason: null,
                  startedAt: "2026-01-01T00:00:00.000Z",
                  status: "active",
                  userId: "student-1",
                },
              ],
              name: "Student",
              platformBlockedAt: null,
              platformBlockedReason: null,
              userId: "student-1",
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    root = createRoot(container);
    act(() => {
      root?.render(
        <StudentManagementSheet
          capabilities={{
            canManageCertificates: true,
            canManageEnrollmentSupport: true,
            canManagePlatformAccess: true,
            canReissueCertificates: true,
          }}
          trigger={<button type="button">Gerenciar</button>}
          userId="student-1"
        />
      );
    });

    await act(async () => {
      container.querySelector("button")?.click();
      await Promise.resolve();
    });
    expect(
      document.querySelector("[data-student-sheet-skeleton]")
    ).toBeTruthy();

    await act(async () => {
      releaseFirstRequest(new Response(null, { status: 503 }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.body.textContent).toContain("Tentar novamente");
    expect(document.querySelector("[data-student-sheet-error]")).toBeTruthy();

    await act(async () => {
      const retry = Array.from(document.body.querySelectorAll("button")).find(
        (button) => button.textContent?.includes("Tentar novamente")
      );
      retry?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.body.textContent).toContain("Student");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    let certificatesTab: HTMLButtonElement | undefined;
    await act(async () => {
      certificatesTab = Array.from(
        document.body.querySelectorAll('[role="tab"]')
      ).find((tab) => tab.textContent === "Certificados") as
        | HTMLButtonElement
        | undefined;
      certificatesTab?.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, button: 0 })
      );
      certificatesTab?.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 0 })
      );
      certificatesTab?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, button: 0 })
      );
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    expect(certificatesTab?.getAttribute("aria-selected")).toBe("true");
    expect(document.body.textContent).toContain("Nova emissão");
  });
});
