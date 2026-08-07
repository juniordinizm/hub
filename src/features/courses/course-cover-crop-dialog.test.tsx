/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-easy-crop", () => ({
  default: () => <div data-testid="cropper" />,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { CourseCoverCropDialog } from "./course-cover-crop-dialog";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

class ResizeObserverMock {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

describe("CourseCoverCropDialog", () => {
  const container = document.createElement("div");
  const root = createRoot(container);

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.ResizeObserver = ResizeObserverMock;
    document.body.append(container);
  });

  afterEach(() => {
    act(() => root.render(null));
    container.remove();
    vi.restoreAllMocks();
  });

  it("describes the canonical 24:25 card crop and revokes the source URL", () => {
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:source");
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    act(() =>
      root.render(
        <CourseCoverCropDialog
          file={new File(["source"], "source.png", { type: "image/png" })}
          onCancel={vi.fn()}
          onComplete={vi.fn()}
        />
      )
    );

    expect(document.body.textContent).toContain(
      "Enquadre a imagem para o card do curso (960 × 1000 px, proporcao 24:25)."
    );
    expect(
      document.body.querySelector('[data-testid="cropper"]')
    ).not.toBeNull();

    act(() =>
      root.render(
        <CourseCoverCropDialog
          file={null}
          onCancel={vi.fn()}
          onComplete={vi.fn()}
        />
      )
    );

    expect(revoke).toHaveBeenCalledWith("blob:source");
    expect(create).toHaveBeenCalledOnce();
  });

  it("delegates cancellation without completing the crop", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:source");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const onCancel = vi.fn();
    const onComplete = vi.fn();

    act(() =>
      root.render(
        <CourseCoverCropDialog
          file={new File(["source"], "source.png", { type: "image/png" })}
          onCancel={onCancel}
          onComplete={onComplete}
        />
      )
    );

    const cancel = [...document.body.querySelectorAll("button")].find(
      (button) => button.textContent === "Cancelar"
    );
    act(() => cancel?.click());
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
