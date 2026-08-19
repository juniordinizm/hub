/**
 * @vitest-environment jsdom
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: { role: "button", tabIndex: 0 },
    isDragging: false,
    listeners: { onPointerDown: vi.fn() },
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
  }),
}));
vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));

import { SortableItem } from "./sortable-list";

describe("SortableItem", () => {
  it("uses a named semantic module drag handle with responsive hit area", () => {
    const markup = renderToStaticMarkup(
      <SortableItem ariaLabel="Reordenar módulo Fundamentos" id="module-1">
        <p>Fundamentos</p>
      </SortableItem>
    );
    const document = new DOMParser().parseFromString(markup, "text/html");
    const handle = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Reordenar módulo Fundamentos"]'
    );

    expect(handle?.type).toBe("button");
    expect(handle?.className).toContain("size-11");
    expect(handle?.className).toContain("md:size-10");
    expect(handle?.className).toContain("touch-manipulation");
  });
});
