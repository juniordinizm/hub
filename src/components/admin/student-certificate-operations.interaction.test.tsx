// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/certificates/actions", () => ({
  issueManualCertificateAction: vi.fn(),
  reissueCertificateAction: vi.fn(),
  revokeCertificateAction: vi.fn(),
}));

import { StudentCertificateOperations } from "./student-certificate-operations";
import type { StudentSheetCertificate } from "./student-management-types";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const course = {
  courseId: "course-1",
  courseTitle: "Curso 1",
  expiresAt: "2027-01-01T00:00:00.000Z",
  id: "enrollment-1",
  originalExpiresAt: "2027-01-01T00:00:00.000Z",
  revokedReason: null,
  startedAt: "2026-01-01T00:00:00.000Z",
  status: "active",
  userId: "student-1",
} as const;

const createCertificate = (
  overrides: Partial<StudentSheetCertificate> = {}
): StudentSheetCertificate => ({
  canReissue: false,
  code: "CERT-OLD",
  courseId: "course-1",
  courseTitle: "Curso 1",
  id: "certificate-old",
  issuedAt: "2026-01-01T00:00:00.000Z",
  renderStatus: "ready" as const,
  revokedAt: null,
  revokedReasonCategory: null,
  status: "valid" as const,
  studentName: "Student",
  workloadHours: 8,
  ...overrides,
});

let root: Root | null = null;
let container: HTMLDivElement;

const openCertificateMenu = async (index: number): Promise<void> => {
  await act(async () => {
    const trigger = document.querySelectorAll(
      'button[aria-label^="Ações do certificado"]'
    )[index] as HTMLButtonElement | undefined;
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

describe("StudentCertificateOperations interaction states", () => {
  it("exposes reissue only for the latest certificate and keeps validation public", async () => {
    root = createRoot(container);
    act(() => {
      root?.render(
        <StudentCertificateOperations
          canIssue={true}
          canReissue={true}
          canRevoke={true}
          certificates={[
            createCertificate({
              canReissue: true,
              code: "CERT-NEW",
              id: "certificate-new",
              issuedAt: "2026-02-01T00:00:00.000Z",
            }),
            createCertificate(),
          ]}
          courses={[course]}
          onRefresh={vi.fn()}
          userId="student-1"
        />
      );
    });

    const links = document.querySelectorAll('a[href="/certificados/CERT-NEW"]');
    expect(links).toHaveLength(0);

    await openCertificateMenu(0);
    expect(document.body.textContent).toContain("Reemitir");
    expect(document.body.textContent).toContain("Revogar");

    await act(async () => {
      document.body.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, button: 0 })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await openCertificateMenu(1);

    expect(document.body.textContent).not.toContain("Reemitir");
    const validationLink = document.querySelector(
      'a[href="/certificados/CERT-OLD"]'
    );
    expect(validationLink).toBeTruthy();
    expect(validationLink?.getAttribute("target")).toBe("_blank");
    expect(validationLink?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("keeps global certificate actions limited to view and course management", async () => {
    root = createRoot(container);
    act(() => {
      root?.render(
        <StudentCertificateOperations
          canIssue={false}
          canReissue={false}
          canRevoke={false}
          certificates={[createCertificate({ code: "CERT-GLOBAL" })]}
          courses={[course]}
          onRefresh={vi.fn()}
          userId="student-1"
        />
      );
    });

    const table = document.querySelector("table");
    expect(table?.textContent).toContain("Ações");
    expect(table?.textContent).not.toContain("Arquivo");

    await openCertificateMenu(0);

    const menuItems = Array.from(
      document.querySelectorAll('[role="menuitem"]')
    ).map((item) => item.textContent?.trim());
    expect(menuItems).toEqual(["Ver certificado", "Gerenciar"]);
    expect(
      document.querySelector(
        'a[href="/admin/cursos/course-1?tab=students&enrollmentStudentId=student-1&enrollmentAction=certificate"]'
      )
    ).toBeTruthy();
  });
});
