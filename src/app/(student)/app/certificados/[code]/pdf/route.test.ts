import { beforeEach, describe, expect, it, vi } from "vitest";

interface StoredCertificate {
  code: string;
  key: string;
  ownerId: string;
  renderStatus: "failed" | "pending" | "ready";
  status: "revoked" | "valid";
}

const dependencies = vi.hoisted(() => ({
  canPerform: vi.fn(),
  createR2ObjectReadUrl: vi.fn(),
  query: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("@/db", () => ({
  getPool: () => ({ query: dependencies.query }),
}));
vi.mock("@/features/storage/r2", () => ({
  createR2ObjectReadUrl: dependencies.createR2ObjectReadUrl,
}));
vi.mock("@/lib/auth-policy", () => ({
  canPerform: dependencies.canPerform,
}));
vi.mock("@/lib/session", () => ({
  requireSession: dependencies.requireSession,
}));

import { GET } from "./route";

const certificates = new Map<string, StoredCertificate>([
  [
    "OWNER-READY",
    {
      code: "OWNER-READY",
      key: "certificates/owner-ready.pdf",
      ownerId: "student-1",
      renderStatus: "ready",
      status: "valid",
    },
  ],
  [
    "REVOKED",
    {
      code: "REVOKED",
      key: "certificates/revoked.pdf",
      ownerId: "student-1",
      renderStatus: "ready",
      status: "revoked",
    },
  ],
  [
    "FAILED",
    {
      code: "FAILED",
      key: "certificates/failed.pdf",
      ownerId: "student-1",
      renderStatus: "failed",
      status: "valid",
    },
  ],
  [
    "PENDING",
    {
      code: "PENDING",
      key: "certificates/pending.pdf",
      ownerId: "student-1",
      renderStatus: "pending",
      status: "valid",
    },
  ],
]);

const requestCertificate = (code: string) =>
  GET(new Request(`https://hub.example.test/app/certificados/${code}/pdf`), {
    params: Promise.resolve({ code }),
  });

describe("GET /app/certificados/[code]/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireSession.mockResolvedValue({
      role: "student",
      user: { id: "student-1" },
    });
    dependencies.canPerform.mockImplementation(
      (role: string) => role === "admin"
    );
    dependencies.createR2ObjectReadUrl.mockResolvedValue(
      "https://private-r2.example.test/signed"
    );
    dependencies.query.mockImplementation(
      (
        sql: string,
        [code, canManageCertificates, userId]: [string, boolean, string]
      ) => {
        expect(sql).toContain("status = 'valid'");
        expect(sql).toContain("render_status = 'ready'");
        const certificate = certificates.get(code);
        const canRead =
          certificate?.status === "valid" &&
          certificate.renderStatus === "ready" &&
          (canManageCertificates || certificate.ownerId === userId);

        return Promise.resolve({
          rows:
            canRead && certificate
              ? [{ pdf_storage_key: certificate.key }]
              : [],
        });
      }
    );
  });

  it("redirects the owner of a valid ready certificate without exposing a response body", async () => {
    const response = await requestCertificate("OWNER-READY");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://private-r2.example.test/signed"
    );
    await expect(response.text()).resolves.toBe("");
    expect(dependencies.createR2ObjectReadUrl).toHaveBeenCalledWith({
      key: "certificates/owner-ready.pdf",
    });
  });

  it("returns 404 to another student without creating a signed URL", async () => {
    dependencies.requireSession.mockResolvedValue({
      role: "student",
      user: { id: "student-2" },
    });

    const response = await requestCertificate("OWNER-READY");

    expect(response.status).toBe(404);
    expect(dependencies.createR2ObjectReadUrl).not.toHaveBeenCalled();
  });

  it("enforces ownership in the SQL sent to Postgres", async () => {
    dependencies.requireSession.mockResolvedValue({
      role: "student",
      user: { id: "student-2" },
    });

    await requestCertificate("OWNER-READY");

    const [sql, parameters] = dependencies.query.mock.calls[0] as [
      string,
      [string, boolean, string],
    ];
    expect(sql).toContain("($2::boolean or user_id = $3)");
    expect(parameters).toEqual(["OWNER-READY", false, "student-2"]);
    expect(dependencies.canPerform).toHaveBeenCalledWith(
      "student",
      "manageCertificates"
    );
  });

  it.each([
    "REVOKED",
    "FAILED",
    "PENDING",
  ] as const)("returns 404 for an inaccessible %s certificate state", async (code) => {
    const response = await requestCertificate(code);

    expect(response.status).toBe(404);
    expect(dependencies.createR2ObjectReadUrl).not.toHaveBeenCalled();
  });

  it("allows an administrator with certificate management permission", async () => {
    dependencies.requireSession.mockResolvedValue({
      role: "admin",
      user: { id: "admin-1" },
    });

    const response = await requestCertificate("OWNER-READY");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://private-r2.example.test/signed"
    );
    const [sql, parameters] = dependencies.query.mock.calls[0] as [
      string,
      [string, boolean, string],
    ];
    expect(sql).toContain("($2::boolean or user_id = $3)");
    expect(parameters).toEqual(["OWNER-READY", true, "admin-1"]);
    expect(dependencies.canPerform).toHaveBeenCalledWith(
      "admin",
      "manageCertificates"
    );
  });
});
