/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LessonFocusLayout } from "./lesson-focus-mode";

const { usePanelFocusMode } = vi.hoisted(() => ({
  usePanelFocusMode: vi.fn(),
}));

vi.mock("@/components/panel-layout", () => ({
  usePanelFocusMode,
}));

describe("LessonFocusLayout", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("removes the course sidebar from keyboard navigation in focus mode", () => {
    usePanelFocusMode.mockReturnValue({ isFocusMode: true });

    act(() => {
      root.render(
        <LessonFocusLayout
          main={<h1>Aula</h1>}
          sidebar={<a href="/app/aulas/next">Próxima aula</a>}
        />
      );
    });

    expect(container.querySelector("a")).toBeNull();
  });
});
