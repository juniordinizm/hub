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

import { CertificateTemplateCropDialog } from "./template-crop-dialog";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

class ResizeObserverMock {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

describe("CertificateTemplateCropDialog", () => {
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

  it("describes the crop and revokes every source URL on replacement or close", () => {
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const onCancel = vi.fn();
    const first = new File(["first"], "first.png", { type: "image/png" });
    const second = new File(["second"], "second.png", { type: "image/png" });

    act(() =>
      root.render(
        <CertificateTemplateCropDialog
          file={first}
          onCancel={onCancel}
          onComplete={vi.fn()}
        />
      )
    );
    expect(document.body.textContent).toContain(
      "Enquadre a imagem para a pagina A4 horizontal."
    );
    expect(
      document.body.querySelector('[data-slot="dialog-description"]')
    ).not.toBeNull();

    act(() =>
      root.render(
        <CertificateTemplateCropDialog
          file={second}
          onCancel={onCancel}
          onComplete={vi.fn()}
        />
      )
    );
    expect(revoke).toHaveBeenCalledWith("blob:first");
    act(() =>
      root.render(
        <CertificateTemplateCropDialog
          file={null}
          onCancel={onCancel}
          onComplete={vi.fn()}
        />
      )
    );
    expect(revoke).toHaveBeenCalledWith("blob:second");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("delegates cancellation without completing the crop", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:source");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const onCancel = vi.fn();
    const onComplete = vi.fn();
    act(() =>
      root.render(
        <CertificateTemplateCropDialog
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
