/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createDraft: vi.fn(),
  publish: vi.fn(),
  toastError: vi.fn(),
  toastLoading: vi.fn(() => "toast-1"),
  toastSuccess: vi.fn(),
}));

vi.mock("@/features/admin/actions", () => ({
  createCoursePublicationDraftAction: dependencies.createDraft,
  publishCoursePublicationAction: dependencies.publish,
}));
vi.mock("sonner", () => ({
  toast: {
    error: dependencies.toastError,
    loading: dependencies.toastLoading,
    success: dependencies.toastSuccess,
  },
}));

import { CoursePublicationAction } from "./course-publication-action";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

describe("CoursePublicationAction", () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderAction = (action: "prepare" | "publish"): void => {
    act(() => {
      root.render(
        <CoursePublicationAction action={action} courseId="course-1" />
      );
    });
  };

  const submit = (): void => {
    const form = container.querySelector("form");
    if (!form) {
      throw new Error("Expected publication form");
    }

    act(() => {
      form.dispatchEvent(
        new SubmitEvent("submit", { bubbles: true, cancelable: true })
      );
    });
  };

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    dependencies.createDraft.mockResolvedValue({ ok: true });
    dependencies.publish.mockResolvedValue({ ok: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("prepares changes once and reports success through Sonner", async () => {
    let resolveAction: (() => void) | undefined;
    dependencies.createDraft.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = () => resolve({ ok: true });
      })
    );
    renderAction("prepare");

    submit();
    submit();

    expect(dependencies.createDraft).toHaveBeenCalledTimes(1);
    expect(dependencies.createDraft).toHaveBeenCalledWith("course-1");
    expect(dependencies.toastLoading).toHaveBeenCalledWith("Preparando…");
    expect(container.querySelector("button")?.disabled).toBe(true);
    expect(container.querySelector("button")?.textContent).toContain(
      "Preparando…"
    );

    await act(async () => resolveAction?.());

    expect(dependencies.toastSuccess).toHaveBeenCalledWith(
      "Alterações preparadas.",
      { id: "toast-1" }
    );
  });

  it("publishes once and keeps typed failures inside actionable Sonner feedback", async () => {
    dependencies.publish.mockResolvedValue({
      message: "Vídeo ainda processando",
      ok: false,
    });
    renderAction("publish");

    submit();
    submit();
    await act(async () => undefined);

    expect(dependencies.publish).toHaveBeenCalledTimes(1);
    expect(dependencies.publish).toHaveBeenCalledWith("course-1");
    expect(dependencies.toastError).toHaveBeenCalledWith(
      "Vídeo ainda processando",
      { id: "toast-1" }
    );
  });
});
