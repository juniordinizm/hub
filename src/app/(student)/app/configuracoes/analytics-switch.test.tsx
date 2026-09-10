/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  refresh: vi.fn(),
  setLearningAnalyticsPreferenceAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: dependencies.refresh }),
}));
vi.mock("@/app/(student)/app/actions", () => ({
  setLearningAnalyticsPreferenceAction:
    dependencies.setLearningAnalyticsPreferenceAction,
}));

import { AnalyticsSwitch } from "./analytics-switch";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("AnalyticsSwitch", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    dependencies.refresh.mockReset();
    dependencies.setLearningAnalyticsPreferenceAction.mockReset();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const renderSwitch = (enabled = true): HTMLButtonElement => {
    act(() => root.render(<AnalyticsSwitch enabled={enabled} />));
    const switchElement = container.querySelector("button");
    if (!switchElement) {
      throw new Error("Analytics switch was not rendered.");
    }
    return switchElement;
  };

  it("updates immediately and refreshes the server state after saving", async () => {
    dependencies.setLearningAnalyticsPreferenceAction.mockResolvedValue(
      undefined
    );
    const switchElement = renderSwitch();

    await act(async () => switchElement.click());

    expect(switchElement.getAttribute("aria-checked")).toBe("false");
    expect(container.textContent).toContain("Desativado");
    expect(
      dependencies.setLearningAnalyticsPreferenceAction
    ).toHaveBeenCalledOnce();
    const formData =
      dependencies.setLearningAnalyticsPreferenceAction.mock.calls[0]?.[0];
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get("enabled")).toBe("false");
    expect(dependencies.refresh).toHaveBeenCalledOnce();
  });

  it("reverts the visual state and announces a failure", async () => {
    dependencies.setLearningAnalyticsPreferenceAction.mockRejectedValue(
      new Error("preference unavailable")
    );
    const switchElement = renderSwitch();

    await act(async () => switchElement.click());

    expect(switchElement.getAttribute("aria-checked")).toBe("true");
    expect(container.textContent).toContain("Ativado");
    expect(container.textContent).toContain(
      "Não foi possível salvar essa preferência"
    );
    expect(dependencies.refresh).not.toHaveBeenCalled();
  });
});
