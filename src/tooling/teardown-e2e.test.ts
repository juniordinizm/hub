import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: vi.fn() }));
vi.mock("@/features/storage/r2", () => ({ deleteR2Objects: vi.fn() }));

import { collectOwnedE2eObjectKeys } from "../../scripts/teardown-e2e";

const cleanup = {
  courseIds: ["course-a"],
  pdfObjectKeys: ["e2e/run/fixture.pdf"],
  runPrefix: "e2e/run/",
};

describe("E2E object cleanup ownership", () => {
  it("includes rendered certificate PDFs proven by the fixture database query", () => {
    expect(
      collectOwnedE2eObjectKeys({
        certificatePdfRows: [
          {
            id: "generated",
            pdf_storage_key: "certificates/generated/certificate.pdf",
          },
        ],
        cleanup,
        templateRows: [
          {
            background_key: "certificates/templates/course-a/background.png",
            signature_key: null,
          },
        ],
      })
    ).toEqual([
      "e2e/run/fixture.pdf",
      "certificates/generated/certificate.pdf",
      "certificates/templates/course-a/background.png",
    ]);
  });

  it("rejects a DB-returned PDF key that does not match its certificate ID", () => {
    expect(() =>
      collectOwnedE2eObjectKeys({
        certificatePdfRows: [
          {
            id: "certificate-a",
            pdf_storage_key: "certificates/certificate-b/certificate.pdf",
          },
        ],
        cleanup,
        templateRows: [],
      })
    ).toThrow(
      "Refusing to delete a certificate PDF outside its owned E2E certificate."
    );
  });

  it("rejects unproven fixture PDF keys outside the run prefix", () => {
    expect(() =>
      collectOwnedE2eObjectKeys({
        certificatePdfRows: [],
        cleanup: {
          ...cleanup,
          pdfObjectKeys: ["certificates/unproven/certificate.pdf"],
        },
        templateRows: [],
      })
    ).toThrow("Refusing to delete a PDF outside the E2E run prefix.");
  });

  it("preserves the course-scoped template ownership guard", () => {
    expect(() =>
      collectOwnedE2eObjectKeys({
        certificatePdfRows: [],
        cleanup,
        templateRows: [
          {
            background_key: "certificates/templates/other/background.png",
            signature_key: null,
          },
        ],
      })
    ).toThrow("Refusing to delete a template outside E2E course IDs.");
  });
});
