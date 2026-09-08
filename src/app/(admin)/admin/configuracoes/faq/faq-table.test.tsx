import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/sortable-table-row", () => ({
  SortableTableRow: ({ children }: { children: ReactNode }) => (
    <tr>{children}</tr>
  ),
}));
vi.mock("@/features/admin/actions", () => ({
  reorderFaqsAction: vi.fn(),
}));
vi.mock("./faq-dialogs", () => ({
  FaqDeleteDialog: () => null,
  FaqEditDialog: () => null,
}));
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  KeyboardSensor: class KeyboardSensor {},
  PointerSensor: class PointerSensor {},
  closestCenter: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn((...sensors: unknown[]) => sensors),
}));
vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  arrayMove: vi.fn(),
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: vi.fn(),
}));

import { FaqTable } from "./faq-table";

describe("FaqTable", () => {
  it("renders a semantic table with status and reorder affordance", () => {
    const markup = renderToStaticMarkup(
      <FaqTable
        faqs={[
          {
            answer: "Resposta da pergunta frequente.",
            id: "faq-1",
            isPublished: true,
            question: "Como acessar o curso?",
            sortOrder: 1,
          },
        ]}
      />
    );

    expect(markup).toContain("Perguntas frequentes cadastradas");
    expect(markup).toContain("Reordenação");
    expect(markup).toContain("Publicado");
    expect(markup).toContain('scope="col"');
  });

  it("keeps the empty state inside the FAQ table", () => {
    const markup = renderToStaticMarkup(<FaqTable faqs={[]} />);

    expect(markup).toContain("<table");
    expect(markup).toContain("Perguntas frequentes cadastradas");
    expect(markup).toContain("Nenhuma FAQ cadastrada");
    expect(markup).toContain('scope="col"');
  });
});
