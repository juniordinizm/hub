/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { Slider } from "./slider";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

class ResizeObserverMock {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

describe("Slider", () => {
  it("names a single thumb from aria-label", () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.ResizeObserver = ResizeObserverMock;
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => root.render(<Slider aria-label="Zoom" value={[1]} />));
    expect(
      container.querySelector('[role="slider"]')?.getAttribute("aria-label")
    ).toBe("Zoom");
    act(() => root.unmount());
  });

  it("provides a distinct accessible name for every thumb", () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.ResizeObserver = ResizeObserverMock;
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() =>
      root.render(
        <Slider thumbLabels={["Minimo", "Maximo"]} value={[20, 80]} />
      )
    );
    expect(
      [...container.querySelectorAll('[role="slider"]')].map((thumb) =>
        thumb.getAttribute("aria-label")
      )
    ).toEqual(["Minimo", "Maximo"]);
    act(() => root.unmount());
  });
});
