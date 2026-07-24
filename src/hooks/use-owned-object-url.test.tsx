/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useOwnedObjectUrl } from "./use-owned-object-url";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const Probe = ({ file }: { file: File | null }): React.JSX.Element => (
  <output>{useOwnedObjectUrl(file)}</output>
);

describe("useOwnedObjectUrl", () => {
  it("revokes each URL when the file changes and on unmount", () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => root.render(<Probe file={new File(["a"], "a.png")} />));
    expect(container.textContent).toBe("blob:first");
    act(() => root.render(<Probe file={new File(["b"], "b.png")} />));
    expect(revoke).toHaveBeenCalledWith("blob:first");
    expect(container.textContent).toBe("blob:second");
    act(() => root.unmount());
    expect(revoke).toHaveBeenCalledWith("blob:second");
    expect(create).toHaveBeenCalledTimes(2);
  });
});
