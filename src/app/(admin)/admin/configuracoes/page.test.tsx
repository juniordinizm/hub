import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dependencies = vi.hoisted(() => ({
  getAdminBannersData: vi.fn(),
  getAdminFaqData: vi.fn(),
  getAdminSettingsData: vi.fn(),
  requirePermission: vi.fn(),
  saveSettingsAction: vi.fn(),
}));

vi.mock("@/features/admin/actions", () => ({
  saveSettingsAction: dependencies.saveSettingsAction,
}));
vi.mock("@/features/admin/server", () => ({
  getAdminBannersData: dependencies.getAdminBannersData,
  getAdminFaqData: dependencies.getAdminFaqData,
  getAdminSettingsData: dependencies.getAdminSettingsData,
}));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));
vi.mock("./banners/banner-gallery", () => ({
  BannerGallery: () => <div>Banners renderizados</div>,
}));
vi.mock("./faq/faq-dialogs", () => ({
  FaqCreateDialog: () => <button type="button">Nova pergunta</button>,
}));
vi.mock("./faq/faq-table", () => ({
  FaqTable: () => <div>FAQs renderizadas</div>,
}));

import AdminSettingsPage from "./page";

describe("AdminSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requirePermission.mockResolvedValue({});
    dependencies.getAdminSettingsData.mockResolvedValue({
      settings: {
        certificateSignerName: "Maria",
        certificateSignerRole: "Diretora",
        issuerCnpj: "04.252.011/0001-10",
        issuerDisplayName: "Empresa",
        issuerLegalName: "Empresa LTDA",
        issuerProfileComplete: true,
        issuerProfileIssues: [],
        lastUpdatedAt: null,
        lastUpdatedBy: null,
      },
    });
    dependencies.getAdminBannersData.mockResolvedValue({ banners: [] });
    dependencies.getAdminFaqData.mockResolvedValue({ faqs: [] });
  });

  it("keeps configuration focused on certificates and editorial content", async () => {
    const markup = renderToStaticMarkup(await AdminSettingsPage());

    expect(markup).toContain("Emissão de certificados");
    expect(markup).toContain("Instituição emissora");
    expect(markup).toContain("Assinatura padrão");
    expect(markup).toContain("Perfil pronto");
    expect(markup).toContain("Ver histórico");
    expect(markup).toContain("Conteúdo editorial");
    expect(markup).toContain("Banners renderizados");
    expect(markup).toContain("FAQs renderizadas");
    expect(markup).not.toContain("JMVStream");
    expect(dependencies.requirePermission).toHaveBeenCalledWith(
      "manageSettings"
    );
  });
});
