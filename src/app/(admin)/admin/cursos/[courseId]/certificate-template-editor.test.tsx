/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { actionMocks, toastMocks } = vi.hoisted(() => ({
  actionMocks: {
    disable: vi.fn(),
    enable: vi.fn(),
    publish: vi.fn(),
    save: vi.fn(),
  },
  toastMocks: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: toastMocks }));
vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,AAAA"),
  },
}));
vi.mock("@/features/admin/actions", () => ({
  disableCertificateForCourseAction: actionMocks.disable,
  enableCertificateForCourseAction: actionMocks.enable,
  publishCertificateTemplateFormAction: actionMocks.publish,
  saveCertificateTemplateDraftFormAction: actionMocks.save,
}));
vi.mock("@/features/admin/certificate-template-action-state", () => ({
  certificateTemplateInitialActionState: { status: "idle" },
}));
vi.mock("@/features/certificates/template-crop-dialog", () => ({
  CertificateTemplateCropDialog: ({
    file,
    onComplete,
  }: {
    file: File | null;
    onComplete: (file: File) => void;
  }) =>
    file ? (
      <button
        onClick={() =>
          onComplete(
            new File(["crop"], "arte-certificado.webp", { type: "image/webp" })
          )
        }
        type="button"
      >
        Confirmar recorte
      </button>
    ) : null,
}));

import { createDefaultCertificateTemplateFields } from "@/features/certificates/template-rules";
import { CertificateTemplateEditor } from "./certificate-template-editor";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

class ResizeObserverMock {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

const setInputValue = (input: HTMLInputElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

const draftTemplate = {
  backgroundUrl: "https://example.test/background.webp",
  signatureKey: "certificates/signature.webp",
  signatureUrl: "https://example.test/signature.webp",
  signerName: "Dra. Maria",
  signerRole: "Responsavel tecnica",
  spec: {
    backgroundKey: "certificates/background.webp",
    fields: createDefaultCertificateTemplateFields(),
  },
  status: "draft" as const,
  version: 2,
};

describe("CertificateTemplateEditor", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.ResizeObserver = ResizeObserverMock;
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    actionMocks.save.mockResolvedValue({ status: "idle" });
    actionMocks.publish.mockResolvedValue({ status: "idle" });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Reflect.deleteProperty(globalThis, "DataTransfer");
    vi.clearAllMocks();
  });

  it("explains the issuer prerequisite and prevents premature publication", () => {
    act(() => {
      root.render(
        <CertificateTemplateEditor
          certificateEnabled={false}
          courseId="course-1"
          issuerConfigured={false}
          templates={[]}
        />
      );
    });

    expect(container.textContent).toContain("Perfil emissor pendente");
    expect(container.textContent).toContain("Dados longos");
    const publishButton = [...container.querySelectorAll("button")].find(
      (button) =>
        button.textContent?.toLocaleLowerCase().includes("publicar") &&
        !button.textContent?.includes("certificado neste curso")
    );
    expect(publishButton?.disabled).toBe(true);
  });

  it("shows the published state with pending draft changes", () => {
    const baseTemplate = {
      backgroundUrl: "https://example.test/background.webp",
      signatureKey: null,
      signatureUrl: null,
      signerName: null,
      signerRole: null,
      spec: {
        backgroundKey: "certificates/background.webp",
        fields: [],
      },
      version: 1,
    };

    act(() => {
      root.render(
        <CertificateTemplateEditor
          certificateEnabled
          courseId="course-1"
          issuerConfigured
          templates={[
            { ...baseTemplate, status: "published" },
            { ...baseTemplate, status: "draft", version: 2 },
          ]}
        />
      );
    });

    expect(container.textContent).toContain("Ativo + alterações");
  });

  it("does not offer activation without a published template", () => {
    act(() => {
      root.render(
        <CertificateTemplateEditor
          certificateEnabled={false}
          courseId="course-1"
          issuerConfigured
          templates={[]}
        />
      );
    });

    expect(container.textContent).toContain(
      "Publique um template para ativar o certificado"
    );
  });

  it("opens the A4 crop before using a new background", () => {
    act(() => {
      root.render(
        <CertificateTemplateEditor
          certificateEnabled={false}
          courseId="course-1"
          issuerConfigured
          templates={[]}
        />
      );
    });
    const input = container.querySelector<HTMLInputElement>(
      'input[name="background"]'
    );
    const source = new File(["image"], "original.png", { type: "image/png" });
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [source],
    });

    act(() => input?.dispatchEvent(new Event("change", { bubbles: true })));
    const confirm = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Confirmar recorte"
    );
    expect(confirm).toBeDefined();
    act(() => confirm?.click());

    expect(container.textContent).toContain("arte-certificado.webp");
  });

  it("keeps signer and signature values in FormData while their accordions are closed", () => {
    act(() => {
      root.render(
        <CertificateTemplateEditor
          certificateEnabled
          courseId="course-1"
          issuerConfigured
          templates={[draftTemplate]}
        />
      );
    });

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    const data = new FormData(form ?? undefined);
    expect(data.get("signerName")).toBe("Dra. Maria");
    expect(data.get("signerRole")).toBe("Responsavel tecnica");
    expect(data.get("signatureKey")).toBe("certificates/signature.webp");
    expect(container.querySelector('input[name="signature"]')).not.toBeNull();
  });

  it("toggles the preview between short and long sample data", () => {
    act(() => {
      root.render(
        <CertificateTemplateEditor
          certificateEnabled
          courseId="course-1"
          issuerConfigured
          templates={[draftTemplate]}
        />
      );
    });
    expect(container.textContent).toContain("Botox");
    const toggle = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Dados longos")
    );
    act(() => toggle?.click());
    expect(container.textContent).toContain(
      "Especialização em Técnicas Avançadas"
    );
  });

  it("shows pending state, inline validation, and success feedback from the save action", async () => {
    let resolveSave: ((value: unknown) => void) | undefined;
    actionMocks.save.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve;
      })
    );
    act(() => {
      root.render(
        <CertificateTemplateEditor
          certificateEnabled
          courseId="course-1"
          issuerConfigured
          templates={[draftTemplate]}
        />
      );
    });
    const visibilitySwitch =
      container.querySelector<HTMLButtonElement>('[role="switch"]');
    act(() => visibilitySwitch?.click());
    const save = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Salvar rascunho")
    );
    act(() => save?.click());
    expect(container.textContent).toContain("Salvando...");

    await act(async () => {
      resolveSave?.({
        fieldErrors: { template: "Revise os campos destacados." },
        message: "Cor invalida.",
        status: "error",
      });
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Rascunho não salvo");
    expect(container.textContent).toContain("Revise os campos destacados.");
    expect(toastMocks.error).toHaveBeenCalledWith("Cor invalida.");

    actionMocks.save.mockResolvedValueOnce({
      message: "Rascunho salvo.",
      status: "success",
    });
    await act(async () => save?.click());
    expect(toastMocks.success).toHaveBeenCalledWith("Rascunho salvo.");
  });

  it("submits a selected background once and clears it after a successful save", async () => {
    const submittedBackgrounds: Array<File | null> = [];
    actionMocks.save.mockImplementation((_state, data: FormData) => {
      submittedBackgrounds.push(data.get("background") as File | null);
      return Promise.resolve({ message: "Rascunho salvo.", status: "success" });
    });
    act(() => {
      root.render(
        <CertificateTemplateEditor
          certificateEnabled
          courseId="course-1"
          issuerConfigured
          templates={[draftTemplate]}
        />
      );
    });
    const backgroundInput = container.querySelector<HTMLInputElement>(
      'input[name="background"]'
    );
    const source = new File(["source"], "original.png", { type: "image/png" });
    Object.defineProperty(backgroundInput, "files", {
      configurable: true,
      value: [source],
      writable: true,
    });
    act(() =>
      backgroundInput?.dispatchEvent(new Event("change", { bubbles: true }))
    );
    Object.defineProperty(globalThis, "DataTransfer", {
      configurable: true,
      value: class {
        files: File[] = [];
        items = {
          add: (file: File) => this.files.push(file),
        };
      },
    });
    const confirm = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Confirmar recorte"
    );
    act(() => confirm?.click());

    const save = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Salvar rascunho")
    );
    await act(async () => save?.click());
    const visibilitySwitch =
      container.querySelector<HTMLButtonElement>('[role="switch"]');
    act(() => visibilitySwitch?.click());
    await act(async () => save?.click());

    expect(submittedBackgrounds[0]?.size).toBeGreaterThan(0);
    expect(submittedBackgrounds[1]).toBeNull();
  });

  it("publishes the current crop, signature, and closed signer values without resending files", async () => {
    const submissions: FormData[] = [];
    actionMocks.publish.mockImplementation((_state, data: FormData) => {
      submissions.push(data);
      return Promise.resolve({
        message: "Certificado publicado.",
        status: "success",
      });
    });
    act(() => {
      root.render(
        <CertificateTemplateEditor
          certificateEnabled
          courseId="course-1"
          issuerConfigured
          templates={[draftTemplate]}
        />
      );
    });
    const backgroundInput = container.querySelector<HTMLInputElement>(
      'input[name="background"]'
    );
    Object.defineProperty(backgroundInput, "files", {
      configurable: true,
      value: [new File(["source"], "source.png", { type: "image/png" })],
    });
    act(() =>
      backgroundInput?.dispatchEvent(new Event("change", { bubbles: true }))
    );
    const confirm = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Confirmar recorte"
    );
    act(() => confirm?.click());

    const signatureInput = container.querySelector<HTMLInputElement>(
      'input[name="signature"]'
    );
    const signature = new File(["signature"], "nova-assinatura.png", {
      type: "image/png",
    });
    Object.defineProperty(signatureInput, "files", {
      configurable: true,
      value: [signature],
    });
    act(() =>
      signatureInput?.dispatchEvent(new Event("change", { bubbles: true }))
    );
    const signer = container.querySelector<HTMLInputElement>(
      'input[name="signerName"]'
    );
    act(() => {
      if (signer) {
        setInputValue(signer, "Dra. Atualizada");
      }
    });

    const publish = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Salvar e publicar")
    );
    await act(async () => publish?.click());
    expect((submissions[0]?.get("background") as File).name).toBe(
      "arte-certificado.webp"
    );
    expect((submissions[0]?.get("signature") as File).name).toBe(
      "nova-assinatura.png"
    );
    expect(submissions[0]?.get("signerName")).toBe("Dra. Atualizada");

    await act(async () => publish?.click());
    expect(submissions[1]?.has("background")).toBe(false);
    expect(submissions[1]?.has("signature")).toBe(false);
  });

  it("provides accessible names for controls and renders the validation QR", async () => {
    act(() => {
      root.render(
        <CertificateTemplateEditor
          certificateEnabled
          courseId="course-1"
          issuerConfigured
          templates={[draftTemplate]}
        />
      );
    });
    const switches = [...container.querySelectorAll('[role="switch"]')];
    expect(switches.length).toBeGreaterThan(0);
    expect(
      switches.every((control) => Boolean(control.getAttribute("aria-label")))
    ).toBe(true);
    const sliders = [...container.querySelectorAll('[role="slider"]')];
    expect(sliders.length).toBeGreaterThan(0);
    expect(
      sliders.every((control) => Boolean(control.getAttribute("aria-label")))
    ).toBe(true);
    const selects = [...container.querySelectorAll('[role="combobox"]')];
    expect(selects.length).toBeGreaterThan(0);
    expect(
      selects.every((control) => {
        const id = control.getAttribute("id");
        return Boolean(id && container.querySelector(`label[for="${id}"]`));
      })
    ).toBe(true);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(
      container.querySelector('img[alt="Código QR de validação"]')
    ).not.toBeNull();
  });

  it("preserves current signer and selected images after validation fails", async () => {
    actionMocks.save.mockResolvedValue({
      fieldErrors: { template: "Revise os campos destacados." },
      message: "Template invalido.",
      status: "error",
    });
    act(() => {
      root.render(
        <CertificateTemplateEditor
          certificateEnabled
          courseId="course-1"
          issuerConfigured
          templates={[draftTemplate]}
        />
      );
    });
    const backgroundInput = container.querySelector<HTMLInputElement>(
      'input[name="background"]'
    );
    Object.defineProperty(backgroundInput, "files", {
      configurable: true,
      value: [new File(["source"], "source.png", { type: "image/png" })],
    });
    act(() =>
      backgroundInput?.dispatchEvent(new Event("change", { bubbles: true }))
    );
    const confirm = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Confirmar recorte"
    );
    act(() => confirm?.click());
    const signatureInput = container.querySelector<HTMLInputElement>(
      'input[name="signature"]'
    );
    Object.defineProperty(signatureInput, "files", {
      configurable: true,
      value: [
        new File(["signature"], "assinatura-atual.png", {
          type: "image/png",
        }),
      ],
    });
    act(() =>
      signatureInput?.dispatchEvent(new Event("change", { bubbles: true }))
    );
    const signer = container.querySelector<HTMLInputElement>(
      'input[name="signerName"]'
    );
    act(() => {
      if (signer) {
        setInputValue(signer, "Dra. Mantida");
      }
    });

    const save = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Salvar rascunho")
    );
    await act(async () => save?.click());

    expect(signer?.value).toBe("Dra. Mantida");
    expect(container.textContent).toContain("arte-certificado.webp");
    expect(container.textContent).toContain("assinatura-atual.png");
  });

  it("submits the save intent through the native keyboard form path", async () => {
    actionMocks.save.mockResolvedValue({
      message: "Rascunho salvo.",
      status: "success",
    });
    act(() => {
      root.render(
        <CertificateTemplateEditor
          certificateEnabled
          courseId="course-1"
          issuerConfigured
          templates={[draftTemplate]}
        />
      );
    });
    const signer = container.querySelector<HTMLInputElement>(
      'input[name="signerName"]'
    );
    act(() => signer?.focus());
    expect(document.activeElement).toBe(signer);
    act(() => {
      if (signer) {
        setInputValue(signer, "Dra. Teclado");
      }
    });
    const form = container.querySelector("form");
    await act(async () => form?.requestSubmit());
    expect(actionMocks.save).toHaveBeenCalledOnce();
    expect(actionMocks.publish).not.toHaveBeenCalled();
    const submitted = actionMocks.save.mock.calls[0]?.[1] as FormData;
    expect(submitted.get("signerName")).toBe("Dra. Teclado");
  });
});
