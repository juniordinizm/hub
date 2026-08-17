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

const renderCourseSettingsForm = (courseToRender = course): void => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(<CourseSettingsForm course={courseToRender} />);
  });
};

const setPrice = (value: string): void => {
  const input = container?.querySelector<HTMLInputElement>(
    'input[name="price"]'
  );
  if (!input) {
    throw new Error("Expected price input.");
  }
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
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

const togglePaymentMethod = (method: "card" | "pix"): void => {
  const checkbox = container?.querySelector<HTMLButtonElement>(
    `#course-payment-${method}`
  );
  if (!checkbox) {
    throw new Error(`Expected ${method} payment method checkbox.`);
  }

  act(() => {
    checkbox.click();
  });
};

describe("course payment settings", () => {
  it("explains when price reduces the effective installment maximum", () => {
    const markup = renderToStaticMarkup(<CourseSettingsForm course={course} />);

    expect(markup).toContain("Checkout será limitado a");
    expect(markup).toContain("1x");
    expect(markup).toContain("3x continua salva");
  });

  it("does not warn when the configured maximum is effective", () => {
    const markup = renderToStaticMarkup(
      <CourseSettingsForm course={{ ...course, priceInCents: 9900 }} />
    );

    expect(markup).not.toContain("Checkout será limitado a");
  });

  it("limits the admin configuration to twelve installments", () => {
    renderCourseSettingsForm({ ...course, priceInCents: 12_000 });
    act(() => {
      container
        ?.querySelector<HTMLButtonElement>("#course-payment-installments")
        ?.click();
    });

    const options = Array.from(
      document.querySelectorAll<HTMLElement>('[role="option"]')
    );
    expect(options).toHaveLength(12);
    expect(options.at(-1)?.textContent).toBe("12x");
    expect(options.at(-1)?.getAttribute("data-disabled")).toBeNull();
  });

  it("keeps installments visible but disabled when card is disabled", async () => {
    renderCourseSettingsForm();

    togglePaymentMethod("card");

    const installments = container?.querySelector<HTMLButtonElement>(
      "#course-payment-installments"
    );
    expect(installments).not.toBeNull();
    expect(installments?.disabled).toBe(true);

    await submitSettingsForm();

    const submittedFormData = saveCourseActionMock.mock.calls[0]?.[0];
    expect(submittedFormData.get("paymentAllowCreditCard")).toBeNull();
    expect(submittedFormData.get("paymentMaxInstallmentCount")).toBeNull();
  });

  it("restores the previous installment ceiling when card is enabled again", () => {
    renderCourseSettingsForm();

    togglePaymentMethod("card");
    togglePaymentMethod("card");

    const installments = container?.querySelector<HTMLButtonElement>(
      "#course-payment-installments"
    );

    expect(installments?.textContent).toContain("3x");
  });

  it("keeps the final enabled payment method selected", () => {
    renderCourseSettingsForm();

    togglePaymentMethod("card");
    togglePaymentMethod("pix");

    expect(
      container
        ?.querySelector<HTMLButtonElement>("#course-payment-pix")
        ?.getAttribute("aria-checked")
    ).toBe("true");
  });

  it("exposes a compact workload trigger and preserves the manual override", () => {
    const automaticMarkup = renderToStaticMarkup(
      <CourseSettingsForm course={course} />
    );
    const manualMarkup = renderToStaticMarkup(
      <CourseSettingsForm course={{ ...course, workloadHoursOverride: 18 }} />
    );

    expect(automaticMarkup).toContain('name="workloadHoursOverride"');
    expect(automaticMarkup).toContain('id="course-settings-workload"');
    expect(automaticMarkup).toContain('aria-label="Editar carga horária"');
    expect(automaticMarkup).toContain("10 horas");
    expect(manualMarkup).toContain('value="18"');
    expect(manualMarkup).toContain("18 horas");
    expect(automaticMarkup).not.toContain(
      'id="course-settings-workload-hours"'
    );
  });

  it("organizes settings into spacious domain sections", () => {
    const markup = renderToStaticMarkup(<CourseSettingsForm course={course} />);

    expect(markup).toContain("Identidade do curso");
    expect(markup).toContain("Acesso e publicação");
    expect(markup).toContain("Oferta de pagamento");
    expect(markup).toContain("Editar carga horária");
    expect(markup).toContain('name="workloadHoursOverride"');
    expect(markup.indexOf("Carga horária")).toBeLessThan(
      markup.indexOf("Meses de acesso")
    );
    expect(markup).not.toContain('id="course-settings-status"');
    expect(markup.indexOf("Meses de acesso")).toBeLessThan(
      markup.indexOf("Oferta de pagamento")
    );
  });

  it("updates the available installment options as the price changes", () => {
    renderCourseSettingsForm({ ...course, priceInCents: 12_000 });
    setPrice("99,00");
    act(() => {
      container
        ?.querySelector<HTMLButtonElement>("#course-payment-installments")
        ?.click();
    });

    const options = Array.from(
      document.querySelectorAll<HTMLElement>('[role="option"]')
    );

    expect(options.at(8)?.textContent).toBe("9x");
    expect(options.at(8)?.getAttribute("data-disabled")).toBeNull();
    expect(options.at(9)?.getAttribute("aria-disabled")).toBe("true");
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
