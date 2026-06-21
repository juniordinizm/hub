/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AutoCloseDialogForm } from "./auto-close-dialog-form";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTriggerButton,
} from "./ui/dialog";

vi.mock("sonner", () => ({
  toast: {
    dismiss: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
  },
}));

describe("dialog interactions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
  });

  it("opens dialog content from the shared trigger button", () => {
    act(() => {
      root.render(
        <Dialog>
          <DialogTriggerButton size="sm" variant="outline">
            Novo curso
          </DialogTriggerButton>
          <DialogContent>
            <DialogTitle>Novo curso</DialogTitle>
          </DialogContent>
        </Dialog>
      );
    });

    const trigger = document.querySelector("button");
    expect(trigger?.getAttribute("data-slot")).toBe("button");
    expect(document.body.textContent).not.toContain("Novo cursoNovo curso");

    act(() => {
      trigger?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
    });

    expect(document.body.textContent).toContain("Novo cursoNovo curso");
  });

  it("submits dialog form data and closes after a successful action", async () => {
    const action = vi.fn((formData: FormData): Promise<void> => {
      expect(formData.get("question")).toBe("Como acessar o curso?");
      return Promise.resolve();
    });

    act(() => {
      root.render(
        <Dialog>
          <DialogTriggerButton>Nova pergunta</DialogTriggerButton>
          <DialogContent>
            <DialogTitle>Nova pergunta</DialogTitle>
            <AutoCloseDialogForm action={action}>
              <input defaultValue="Como acessar o curso?" name="question" />
              <Button type="submit">Salvar FAQ</Button>
            </AutoCloseDialogForm>
          </DialogContent>
        </Dialog>
      );
    });

    const trigger = document.querySelector("button");
    act(() => {
      trigger?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
    });

    const form = document.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
      await Promise.resolve();
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("Salvar FAQ");
  });
});
