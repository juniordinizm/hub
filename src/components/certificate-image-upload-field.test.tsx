/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import { CertificateImageUploadField } from "./certificate-image-upload-field";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

describe("CertificateImageUploadField", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("accepts a 5 MiB background without creating its own object URL", () => {
    const onFileSelect = vi.fn();
    const createObjectURL = vi.spyOn(URL, "createObjectURL");
    act(() => {
      root.render(
        <CertificateImageUploadField
          imageUrl={null}
          kind="background"
          onFileSelect={onFileSelect}
        />
      );
    });
    const file = new File([new Uint8Array(5 * 1024 * 1024)], "arte.png", {
      type: "image/png",
    });
    const input = container.querySelector("input[type=file]");
    Object.defineProperty(input, "files", { value: [file] });

    act(() => input?.dispatchEvent(new Event("change", { bubbles: true })));

    expect(onFileSelect).toHaveBeenCalledWith(file);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("rejects a signature above 2 MiB", () => {
    const onFileSelect = vi.fn();
    act(() => {
      root.render(
        <CertificateImageUploadField
          imageUrl={null}
          kind="signature"
          onFileSelect={onFileSelect}
        />
      );
    });
    const file = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "firma.png", {
      type: "image/png",
    });
    const input = container.querySelector("input[type=file]");
    Object.defineProperty(input, "files", { value: [file] });

    act(() => input?.dispatchEvent(new Event("change", { bubbles: true })));

    expect(onFileSelect).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("2 MB"));
  });
});
