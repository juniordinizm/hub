/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const saveCourseActionMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/admin/actions", () => ({
  saveCourseAction: saveCourseActionMock,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
  },
}));

import { formatCurrencyInCents } from "@/lib/formatters";
import { type CourseData, CourseSettingsForm } from "./course-dialogs-client";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

class ResizeObserverMock {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

const course: CourseData = {
  accessDurationMonths: 12,
  description: "Curso de teste",
  id: "course-1",
  paymentAllowCreditCard: true,
  paymentAllowPix: true,
  paymentMaxInstallmentCount: 3,
  priceInCents: 1990,
  slug: "curso-teste",
  status: "active",
  subtitle: null,
  thumbnailUrl: null,
  title: "Curso de teste",
  workloadHours: 10,
  workloadHoursOverride: null,
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = ResizeObserverMock;
  saveCourseActionMock.mockReset();
  saveCourseActionMock.mockResolvedValue(undefined);
});

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
  document.body.innerHTML = "";
});

const renderCourseSettingsForm = (): void => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(<CourseSettingsForm course={course} />);
  });
};

const setPrice = (value: string): void => {
  const input = container?.querySelector<HTMLInputElement>(
    'input[name="price"]'
  );
  if (!input) {
    throw new Error("Expected price input.");
  }
  input.value = value;
};

const submitSettingsForm = async (): Promise<void> => {
  const form = container?.querySelector("form");
  if (!form) {
    throw new Error("Expected Course settings form.");
  }
  await act(async () => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    await Promise.resolve();
  });
};

const findButton = (label: string): HTMLButtonElement => {
  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === label
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected button: ${label}`);
  }
  return button;
};

const clickButton = (label: string): void => {
  act(() => {
    findButton(label).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
  });
};

const clickButtonAsync = async (label: string): Promise<void> => {
  await act(async () => {
    findButton(label).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
    await Promise.resolve();
  });
};

describe("course payment settings", () => {
  it("explains when price reduces the effective installment maximum", () => {
    const markup = renderToStaticMarkup(<CourseSettingsForm course={course} />);

    expect(markup).toContain("Checkout sera limitado a");
    expect(markup).toContain("1x");
    expect(markup).toContain("3x continua salva");
  });

  it("does not warn when the configured maximum is effective", () => {
    const markup = renderToStaticMarkup(
      <CourseSettingsForm course={{ ...course, priceInCents: 9900 }} />
    );

    expect(markup).not.toContain("Checkout sera limitado a");
  });

  it("limits the admin configuration to twelve installments", () => {
    const markup = renderToStaticMarkup(<CourseSettingsForm course={course} />);

    expect(markup).toContain('name="paymentMaxInstallmentCount"');
    expect(markup).toContain('max="12"');
  });

  it("exposes the automatic workload calculation and manual course override", () => {
    const automaticMarkup = renderToStaticMarkup(
      <CourseSettingsForm course={course} />
    );
    const manualMarkup = renderToStaticMarkup(
      <CourseSettingsForm course={{ ...course, workloadHoursOverride: 18 }} />
    );

    expect(automaticMarkup).toContain('name="workloadHoursOverride"');
    expect(automaticMarkup).toContain("Automática: 10 horas");
    expect(manualMarkup).toContain('value="18"');
    expect(automaticMarkup).toContain(
      "Deixe vazio para calcular automaticamente pela soma das aulas."
    );
  });

  it("saves an equivalent price without opening confirmation", async () => {
    renderCourseSettingsForm();
    setPrice("19,90");
    await submitSettingsForm();

    expect(saveCourseActionMock).toHaveBeenCalledOnce();
    expect(document.body.textContent).not.toContain(
      "Confirmar alteração de preço?"
    );
  });

  it("waits for confirmation before saving a changed price", async () => {
    renderCourseSettingsForm();
    setPrice("29,90");
    await submitSettingsForm();

    expect(saveCourseActionMock).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Confirmar alteração de preço?"
    );
    expect(document.body.textContent).toContain(formatCurrencyInCents(1990));
    expect(document.body.textContent).toContain(formatCurrencyInCents(2990));
  });

  it("does not save when the price confirmation is cancelled", async () => {
    renderCourseSettingsForm();
    setPrice("29,90");
    await submitSettingsForm();

    clickButton("Cancelar");

    expect(saveCourseActionMock).not.toHaveBeenCalled();
  });

  it("saves the original form snapshot after confirming a changed price", async () => {
    renderCourseSettingsForm();
    setPrice("29,90");
    await submitSettingsForm();
    setPrice("39,90");
    await clickButtonAsync("Confirmar alteração");

    expect(saveCourseActionMock).toHaveBeenCalledOnce();
    const submittedFormData = saveCourseActionMock.mock.calls[0]?.[0];
    expect(submittedFormData).toBeInstanceOf(FormData);
    expect(submittedFormData.get("price")).toBe("29,90");
  });
});
