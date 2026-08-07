/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { stagedUploadMock } = vi.hoisted(() => ({
  stagedUploadMock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("@/features/storage/staged-image-upload-client", () => ({
  uploadStagedAdminImage: stagedUploadMock,
}));
vi.mock("@/features/courses/course-cover-crop-dialog", () => ({
  CourseCoverCropDialog: ({
    file,
    onComplete,
  }: {
    file: File | null;
    onComplete: (file: File) => void;
  }) =>
    file ? (
      <button
        onClick={() =>
          onComplete(
            new File(["cropped"], "cropped.webp", { type: "image/webp" })
          )
        }
        type="button"
      >
        Confirmar recorte
      </button>
    ) : null,
}));

import { CourseCoverUploadField } from "./course-cover-upload-field";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const aggregateId = "c989d54d-d13f-46a1-89ed-2069d7c1c45b";

const deferred = <Value,>() => {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const referenceFor = (fileName: string) => ({
  aggregateId,
  contentType: "image/png",
  fileName,
  key: `uploads/admin-images/admin-1/course/${aggregateId}/course-cover/${fileName}`,
  purpose: "course-cover" as const,
  sizeBytes: 1,
});

describe("CourseCoverUploadField", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    stagedUploadMock.mockReset();
    vi.spyOn(URL, "createObjectURL").mockImplementation(
      (file) => `blob:${(file as File).name}`
    );
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("ignores an older upload response after a newer file was selected", async () => {
    const first = deferred<ReturnType<typeof referenceFor>>();
    const second = deferred<ReturnType<typeof referenceFor>>();
    stagedUploadMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    act(() => {
      root.render(<CourseCoverUploadField aggregateId={aggregateId} />);
    });
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    const select = (file: File): void => {
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [file],
      });
      input?.dispatchEvent(new Event("change", { bubbles: true }));
    };

    act(() => select(new File(["a"], "a.png", { type: "image/png" })));
    act(() =>
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "Confirmar recorte")
        ?.click()
    );
    act(() => select(new File(["b"], "b.png", { type: "image/png" })));
    act(() =>
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "Confirmar recorte")
        ?.click()
    );
    await act(async () => {
      first.resolve(referenceFor("a.png"));
      await first.promise;
    });

    expect(
      container.querySelector<HTMLInputElement>('input[name="coverUpload"]')
        ?.value
    ).toBe("");
    expect(
      container.querySelector<HTMLInputElement>(
        'input[name="coverUploadPending"]'
      )?.value
    ).toBe("on");

    await act(async () => {
      second.resolve(referenceFor("b.png"));
      await second.promise;
    });
    expect(
      JSON.parse(
        container.querySelector<HTMLInputElement>('input[name="coverUpload"]')
          ?.value ?? "{}"
      ).fileName
    ).toBe("b.png");
    expect(
      container.querySelector<HTMLInputElement>(
        'input[name="coverUploadPending"]'
      )?.value
    ).toBe("");
  });

  it("waits for the card crop before staging a selected file", async () => {
    stagedUploadMock.mockResolvedValue(referenceFor("cropped.webp"));

    act(() => {
      root.render(<CourseCoverUploadField aggregateId={aggregateId} />);
    });
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    const source = new File(["source"], "source.png", { type: "image/png" });

    Object.defineProperty(input, "files", {
      configurable: true,
      value: [source],
    });
    act(() => input?.dispatchEvent(new Event("change", { bubbles: true })));

    expect(stagedUploadMock).not.toHaveBeenCalled();
    expect(
      [...container.querySelectorAll("button")].some(
        (button) => button.textContent === "Confirmar recorte"
      )
    ).toBe(true);

    act(() =>
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "Confirmar recorte")
        ?.click()
    );
    await act(async () => undefined);

    expect(stagedUploadMock).toHaveBeenCalledWith({
      aggregateId,
      file: expect.objectContaining({
        name: "cropped.webp",
        type: "image/webp",
      }),
      purpose: "course-cover",
    });
  });
});
