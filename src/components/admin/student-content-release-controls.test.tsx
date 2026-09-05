import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/admin/actions", () => ({
  grantEnrollmentFullContentAccessAction: vi.fn(),
}));

import { StudentContentReleaseControls } from "./student-content-release-controls";

const enrollment = {
  courseId: "course-1",
  courseTitle: "Curso",
  expiresAt: "2027-01-01T00:00:00.000Z",
  id: "enrollment-1",
  originalExpiresAt: "2027-01-01T00:00:00.000Z",
  revokedReason: null,
  startedAt: "2026-09-04T00:00:00.000Z",
  status: "active",
  userId: "student-1",
};

describe("StudentContentReleaseControls", () => {
  it("is absent for full access and visible for scheduled access", () => {
    expect(
      renderToStaticMarkup(
        <StudentContentReleaseControls
          enrollment={{ ...enrollment, contentReleaseMode: "full_access" }}
          onSuccess={vi.fn()}
        />
      )
    ).toBe("");

    const markup = renderToStaticMarkup(
      <StudentContentReleaseControls
        enrollment={{
          ...enrollment,
          contentReleaseMode: "scheduled",
          contentReleaseStartedAt: "2026-09-04T00:00:00.000Z",
          nextModuleReleaseAt: "2026-09-12T00:00:00.000Z",
        }}
        onSuccess={vi.fn()}
      />
    );
    expect(markup).toContain("Liberação programada");
    expect(markup).toContain("Liberar conteúdo integral");
    expect(markup).toContain("Motivo");
  });
});
