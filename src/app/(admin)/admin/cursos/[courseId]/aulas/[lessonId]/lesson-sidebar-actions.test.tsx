/**
 * @vitest-environment jsdom
 */

import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  saveLesson: vi.fn(),
  toastError: vi.fn(),
  toastLoading: vi.fn(() => "toast-1"),
  toastSuccess: vi.fn(),
}));

vi.mock("@/features/admin/actions", () => ({
  saveLessonAction: dependencies.saveLesson,
}));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));
vi.mock("sonner", () => ({
  toast: {
    error: dependencies.toastError,
    loading: dependencies.toastLoading,
    success: dependencies.toastSuccess,
  },
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }: ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
  SelectValue: () => null,
}));

import { LessonSidebarActions } from "./lesson-sidebar-actions";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

describe("LessonSidebarActions", () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderActions = (): void => {
    act(() => {
      root.render(
        <>
          <form id="lesson-form" />
          <LessonSidebarActions
            coursePublicationStatus="draft"
            formId="lesson-form"
            initialStatus="draft"
          />
        </>
      );
    });
  };

  const clickSave = async (): Promise<void> => {
    const button = container.querySelector<HTMLButtonElement>(
      'button[type="submit"]'
    );
    if (!button) {
      throw new Error("Expected lesson save button");
    }

    act(() => button.click());
    await act(async () => undefined);
  };

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    dependencies.saveLesson.mockResolvedValue({ ok: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows the server-provided content reason and does not report success", async () => {
    const message =
      "A aula não pode ser salva sem conteúdo. Adicione pelo menos um vídeo, um texto com conteúdo ou um material anexado.";
    dependencies.saveLesson.mockResolvedValue({
      field: "content",
      message,
      ok: false,
    });
    renderActions();

    await clickSave();

    expect(dependencies.toastError).toHaveBeenCalledWith(message, {
      id: "toast-1",
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      message
    );
    expect(dependencies.toastSuccess).not.toHaveBeenCalled();
  });

  it("clears the persistent error and reports success after a later valid save", async () => {
    const message = "Informe o título da aula.";
    dependencies.saveLesson
      .mockResolvedValueOnce({ field: "title", message, ok: false })
      .mockResolvedValueOnce({ ok: true });
    renderActions();

    await clickSave();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      message
    );

    await clickSave();

    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(dependencies.toastSuccess).toHaveBeenCalledWith(
      "Aula salva com sucesso!",
      { id: "toast-1" }
    );
  });
});
