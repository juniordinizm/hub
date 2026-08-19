/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  refresh: vi.fn(),
  setCourseSaleInterestAction: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: dependencies.refresh }),
}));
vi.mock("server-only", () => ({}));
vi.mock("sonner", () => ({
  toast: {
    error: dependencies.toastError,
    success: dependencies.toastSuccess,
  },
}));
vi.mock("@/app/(student)/app/actions", () => ({
  setCourseSaleInterestAction: dependencies.setCourseSaleInterestAction,
}));

import { CourseInterestButton } from "./course-interest-button";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

describe("CourseInterestButton", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    dependencies.setCourseSaleInterestAction.mockResolvedValue({
      interested: true,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("confirms an interest subscription with Sonner and updates the button", async () => {
    act(() => {
      root.render(
        <CourseInterestButton courseId="course-1" isInterested={false} />
      );
    });

    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
      await Promise.resolve();
    });

    expect(dependencies.setCourseSaleInterestAction).toHaveBeenCalledOnce();
    expect(dependencies.toastSuccess).toHaveBeenCalledWith(
      "Aviso ativado. Você será avisada quando as inscrições abrirem."
    );
    expect(container.textContent).toContain("Cancelar aviso");
    expect(dependencies.refresh).toHaveBeenCalledOnce();
  });
});
