/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "./use-media-query";

const Probe = (): React.JSX.Element => {
  const matches = useMediaQuery("(max-width: 1023px)");
  return <output>{String(matches)}</output>;
};

describe("useMediaQuery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts hydration-safe and follows media query changes", () => {
    let matches = true;
    let changeListener: (() => void) | undefined;
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        addEventListener: (_type: string, listener: () => void) => {
          changeListener = listener;
        },
        dispatchEvent: vi.fn(),
        get matches() {
          return matches;
        },
        media: "(max-width: 1023px)",
        onchange: null,
        removeEventListener: vi.fn(),
      }))
    );

    expect(renderToStaticMarkup(<Probe />)).toContain("false");

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => root.render(<Probe />));
    expect(container.textContent).toBe("true");

    matches = false;
    act(() => changeListener?.());
    expect(container.textContent).toBe("false");

    act(() => root.unmount());
  });
});
