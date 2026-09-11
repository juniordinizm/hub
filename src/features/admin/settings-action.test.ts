import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => {
  const clientQuery = vi.fn();
  const client = {
    query: clientQuery,
    release: vi.fn(),
  };
  const pool = {
    connect: vi.fn().mockResolvedValue(client),
  };

  return {
    client,
    clientQuery,
    getPool: vi.fn(() => pool),
    revalidatePath: vi.fn(),
    requireRole: vi.fn(),
    writeAuditLog: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: dependencies.revalidatePath }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/admin/audit-log", () => ({
  writeAuditLog: dependencies.writeAuditLog,
}));
vi.mock("@/lib/session", () => ({ requireRole: dependencies.requireRole }));

import {
  deleteFaqAction,
  reorderFaqsAction,
  saveFaqAction,
  saveSettingsAction,
} from "./actions";

const WHITESPACE_PATTERN = /\s+/;

const createSettingsForm = (
  values: {
    cnpj?: string;
    displayName?: string;
    legalName?: string;
    signerName?: string;
  } = {}
): FormData => {
  const formData = new FormData();
  formData.set("certificateSignerName", values.signerName ?? "Maria");
  formData.set("certificateSignerRole", "Diretora");
  formData.set("issuerLegalName", values.legalName ?? "Empresa LTDA");
  formData.set("issuerDisplayName", values.displayName ?? "Empresa");
  formData.set("issuerCnpj", values.cnpj ?? "04252011000110");
  return formData;
};

describe("saveSettingsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireRole.mockResolvedValue({
      role: "admin",
      user: { id: "admin-1" },
    });
    dependencies.clientQuery.mockImplementation((sql: string) => {
      if (sql.includes("from app_settings")) {
        return Promise.resolve({
          rows: [
            {
              certificate_signer_name: "Ana",
              certificate_signer_role: "Gestora",
            },
          ],
        });
      }
      if (sql.includes("from certificate_issuer_profiles")) {
        return Promise.resolve({
          rows: [
            {
              cnpj: "98.765.432/0001-98",
              display_name: "Empresa antiga",
              legal_name: "Empresa Antiga LTDA",
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });
  });

  it("rejects an incomplete issuer profile before starting a transaction", async () => {
    const formData = createSettingsForm({ cnpj: "" });

    await expect(saveSettingsAction(formData)).rejects.toThrow(
      "Preencha razão social e CNPJ"
    );
    expect(dependencies.clientQuery).not.toHaveBeenCalled();
    expect(dependencies.writeAuditLog).not.toHaveBeenCalled();
  });

  it("persists the complete state and audits safe before/after values atomically", async () => {
    await saveSettingsAction(createSettingsForm());

    const statements = dependencies.clientQuery.mock.calls.map(([sql]) =>
      String(sql).trim().split(WHITESPACE_PATTERN).slice(0, 3).join(" ")
    );
    expect(statements[0]).toBe("BEGIN");
    expect(statements.at(-1)).toBe("COMMIT");
    expect(dependencies.clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("insert into app_settings"),
      ["Maria", "Diretora"]
    );
    expect(dependencies.clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("insert into certificate_issuer_profiles"),
      ["Empresa LTDA", "04.252.011/0001-10", "Empresa"]
    );
    expect(dependencies.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "settings.updated",
        actorUserId: "admin-1",
        client: dependencies.client,
        metadata: expect.objectContaining({
          changes: expect.objectContaining({
            certificateSignerName: {
              after: "Maria",
              before: "Ana",
            },
            issuerCnpj: {
              after: "••••0110",
              before: "••••0198",
            },
          }),
        }),
      })
    );
    const metadata = dependencies.writeAuditLog.mock.calls[0]?.[0]?.metadata;
    expect(JSON.stringify(metadata)).not.toContain("04.252.011/0001-10");
    expect(dependencies.revalidatePath).toHaveBeenCalledWith(
      "/admin/configuracoes"
    );
  });

  it("rejects an empty issuer profile before starting a transaction", async () => {
    await expect(
      saveSettingsAction(
        createSettingsForm({ cnpj: "", legalName: "", displayName: "" })
      )
    ).rejects.toThrow("Informe razão social e CNPJ");
    expect(dependencies.clientQuery).not.toHaveBeenCalled();
    expect(dependencies.writeAuditLog).not.toHaveBeenCalled();
  });

  it("rejects an invalid CNPJ before starting a transaction", async () => {
    const formData = createSettingsForm({ cnpj: "04.252.011/0001-11" });

    await expect(saveSettingsAction(formData)).rejects.toThrow(
      "CNPJ válido com 14 dígitos"
    );
    expect(dependencies.clientQuery).not.toHaveBeenCalled();
    expect(dependencies.writeAuditLog).not.toHaveBeenCalled();
  });

  it("rolls back settings when a later write fails", async () => {
    dependencies.clientQuery.mockImplementation((sql: string) => {
      if (sql.includes("from app_settings")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("from certificate_issuer_profiles")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("insert into app_settings")) {
        return Promise.reject(new Error("database unavailable"));
      }
      return Promise.resolve({ rows: [] });
    });

    await expect(saveSettingsAction(createSettingsForm())).rejects.toThrow(
      "database unavailable"
    );
    expect(dependencies.clientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(dependencies.client.release).toHaveBeenCalledOnce();
    expect(dependencies.writeAuditLog).not.toHaveBeenCalled();
  });

  it("audits FAQ creation and updates with the affected values", async () => {
    dependencies.clientQuery.mockImplementation((sql: string) => {
      if (sql.includes("from faq_items")) {
        return Promise.resolve({
          rows: [
            {
              answer: "Resposta anterior",
              is_published: false,
              question: "Pergunta anterior",
              sort_order: 2,
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });
    const formData = new FormData();
    formData.set("faqId", "faq-1");
    formData.set("question", "Pergunta nova");
    formData.set("answer", "Resposta nova");
    formData.set("sortOrder", "1");
    formData.set("isPublished", "on");

    await saveFaqAction(formData);

    expect(dependencies.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "faq.updated",
        targetId: "faq-1",
        metadata: expect.objectContaining({
          changes: expect.objectContaining({
            answer: { after: "Resposta nova", before: "Resposta anterior" },
            isPublished: { after: true, before: false },
            question: { after: "Pergunta nova", before: "Pergunta anterior" },
            sortOrder: { after: 1, before: 2 },
          }),
        }),
      })
    );
    expect(dependencies.clientQuery).toHaveBeenCalledWith("COMMIT");
  });

  it("audits FAQ deletion and keeps it atomic", async () => {
    dependencies.clientQuery.mockImplementation((sql: string) => {
      if (sql.includes("from faq_items")) {
        return Promise.resolve({
          rows: [
            {
              answer: "Resposta",
              is_published: true,
              question: "Pergunta",
              sort_order: 1,
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });
    const formData = new FormData();
    formData.set("faqId", "faq-1");

    await deleteFaqAction(formData);

    expect(dependencies.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "faq.deleted",
        client: dependencies.client,
        targetId: "faq-1",
      })
    );
    expect(dependencies.clientQuery).toHaveBeenCalledWith("COMMIT");
  });

  it("records the previous and next FAQ order", async () => {
    dependencies.clientQuery.mockImplementation((sql: string) => {
      if (sql.includes("select id, question, sort_order")) {
        return Promise.resolve({
          rows: [
            { id: "faq-1", question: "Primeira", sort_order: 1 },
            { id: "faq-2", question: "Segunda", sort_order: 2 },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    await reorderFaqsAction(["faq-2", "faq-1"]);

    expect(dependencies.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "faq.reordered",
        metadata: expect.objectContaining({
          changes: {
            order: {
              after: ["Segunda", "Primeira"],
              before: ["Primeira", "Segunda"],
            },
          },
        }),
      })
    );
  });
});
