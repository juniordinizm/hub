import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/admin/actions", () => ({
  blockStudentPlatformAccessAction: vi.fn(),
  restoreStudentPlatformAccessAction: vi.fn(),
}));
vi.mock("@/features/certificates/actions", () => ({
  issueManualCertificateAction: vi.fn(),
  reissueCertificateAction: vi.fn(),
  revokeCertificateAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { StudentsTable, type StudentTableRow } from "./students-table";

const student: StudentTableRow = {
  courseCount: 1,
  email: "aluna@example.com",
  enrollments: [],
  firstEnrollmentAt: null,
  lastAccessAt: null,
  latestExpiration: null,
  name: "Aluna Teste",
  platformBlockedAt: null,
  platformBlockedReason: null,
  userId: "student-1",
};

describe("StudentsTable", () => {
  it("exposes one Gerenciar action for the shared student Sheet", () => {
    const markup = renderToStaticMarkup(<StudentsTable students={[student]} />);

    expect(markup).toContain("Gerenciar");
    expect(markup).not.toContain("Abrir ficha");
  });

  it("announces the current page range and total result count", () => {
    const markup = renderToStaticMarkup(
      <StudentsTable
        page={2}
        pageSize={1}
        students={[student]}
        totalCount={3}
      />
    );

    expect(markup).toContain("2–2 de 3 alunas");
  });
});
