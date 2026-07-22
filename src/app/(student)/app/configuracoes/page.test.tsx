import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getLearningAnalyticsPreference: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("@/app/(student)/app/actions", () => ({
  setLearningAnalyticsPreferenceAction: vi.fn(),
  updateCertificateNameAction: vi.fn(),
}));
vi.mock("@/features/learning-analytics/server", () => ({
  getLearningAnalyticsPreference: dependencies.getLearningAnalyticsPreference,
}));
vi.mock("@/lib/session", () => ({
  requireSession: dependencies.requireSession,
}));

import StudentSettingsPage from "./page";

describe("StudentSettingsPage", () => {
  it("shows the default-enabled analytics preference and its opt-out action", async () => {
    dependencies.requireSession.mockResolvedValue({
      user: { id: "student-1" },
    });
    dependencies.getLearningAnalyticsPreference.mockResolvedValue(true);

    const markup = renderToStaticMarkup(await StudentSettingsPage());

    expect(markup).toContain("Configurações");
    expect(markup).toContain("Privacidade e Dados");
    expect(markup).toContain("Melhoria das aulas");
    expect(markup).not.toContain("consentimento");
    expect(markup).not.toContain("autorizar");
  });
});
