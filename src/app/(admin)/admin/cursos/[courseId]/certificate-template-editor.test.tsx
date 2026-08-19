/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  actionMocks,
  mediaQueryMocks,
  navigationMocks,
  stagedUploadMock,
  toastMocks,
} = vi.hoisted(() => ({
  actionMocks: {
    disable: vi.fn(),
    enable: vi.fn(),
    publish: vi.fn(),
    reconcile: vi.fn(),
    save: vi.fn(),
  },
  mediaQueryMocks: { matches: false },
  navigationMocks: { refresh: vi.fn() },
  stagedUploadMock: vi.fn(),
  toastMocks: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: toastMocks }));
vi.mock("next/navigation", () => ({
  useRouter: () => navigationMocks,
}));
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
vi.mock("@/features/certificates/actions", () => ({
  reconcileHistoricalCertificatesAction: actionMocks.reconcile,
}));
vi.mock("@/features/admin/certificate-template-action-state", () => ({
  certificateTemplateInitialActionState: { status: "idle" },
}));
vi.mock("@/features/storage/staged-image-upload-client", () => ({
  uploadStagedAdminImage: stagedUploadMock,
}));
vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: () => mediaQueryMocks.matches,
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

const setDraftInputValue = (input: HTMLInputElement, value: string): void => {
  setInputValue(input, value);
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const selectField = (
  container: HTMLDivElement,
  field: string
): HTMLButtonElement => {
  const previewField = container.querySelector<HTMLButtonElement>(
    `[data-editor-field="${field}"]`
  );
  if (previewField) {
    act(() => previewField.click());
    return previewField;
  }
  const visibilityTrigger = container.querySelector<HTMLButtonElement>(
    '[data-visibility-trigger="true"]'
  );
  act(() => visibilityTrigger?.click());
  const button = document.body.querySelector<HTMLButtonElement>(
    `[data-field-row="${field}"] > button`
  );
  if (!button) {
    throw new Error(`Field row not found: ${field}`);
  }
  act(() => button.click());
  return button;
};

const toggleFieldVisibility = (
  container: HTMLDivElement,
  field: string
): void => {
  const visibilityTrigger = container.querySelector<HTMLButtonElement>(
    '[data-visibility-trigger="true"]'
  );
  act(() => visibilityTrigger?.click());
  const switchControl = document.body.querySelector<HTMLButtonElement>(
    `[data-field-row="${field}"] [role="switch"]`
  );
  act(() => switchControl?.click());
};

const selectBackground = (container: HTMLDivElement): HTMLButtonElement => {
  const background = container.querySelector<HTMLButtonElement>(
    '[data-editor-background="true"]'
  );
  if (!background) {
    throw new Error("Background hit area not found");
  }
  act(() => background.click());
  return background;
};

const dispatchPointer = (
  target: Element,
  type: "pointerdown" | "pointermove" | "pointerup",
  values: {
    button?: number;
    clientX: number;
    clientY: number;
    pointerId: number;
    shiftKey?: boolean;
  }
): void => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    button: { configurable: true, value: values.button ?? 0 },
    clientX: { configurable: true, value: values.clientX },
    clientY: { configurable: true, value: values.clientY },
    pointerId: { configurable: true, value: values.pointerId },
    shiftKey: { configurable: true, value: values.shiftKey ?? false },
  });
  act(() => target.dispatchEvent(event));
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
const overlapMessagePattern = /sobreposi/;

describe("CertificateTemplateEditor", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.ResizeObserver = ResizeObserverMock;
    mediaQueryMocks.matches = false;
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    actionMocks.save.mockResolvedValue({ status: "idle" });
    actionMocks.publish.mockResolvedValue({ status: "idle" });
    actionMocks.reconcile.mockResolvedValue({
      issued: 3,
      message: "3 certificados enviados para geracao. Restam 0.",
      remaining: 0,
      status: "success",
    });
    stagedUploadMock.mockImplementation(
      ({
        aggregateId,
        file,
        purpose,
      }: {
        aggregateId: string;
        file: File;
        purpose: string;
      }) =>
        Promise.resolve({
          aggregateId,
          contentType: file.type,
          fileName: file.name,
          key: `uploads/admin-images/admin-1/${purpose}/upload.webp`,
          sizeBytes: file.size,
        })
    );
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  it("moves the selected inspector into a persistent bottom sheet on compact screens", () => {
    mediaQueryMocks.matches = true;
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

    selectField(container, "studentName");

    const mobileSheet = document.body.querySelector(
      '[data-mobile-properties-sheet="true"]'
    );
    expect(mobileSheet).not.toBeNull();
    expect(
      mobileSheet?.querySelector('[data-field-inspector="studentName"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-properties-panel="true"]')
    ).toBeNull();
    expect(
      new FormData(container.querySelector("form") ?? undefined).get(
        "signerName"
      )
    ).toBe(draftTemplate.signerName);

    const specBefore =
      container.querySelector<HTMLInputElement>('input[name="spec"]')?.value;
    const close = mobileSheet?.querySelector<HTMLButtonElement>(
      '[data-slot="sheet-close"]'
    );
    act(() => close?.click());
    expect(
      document.body.querySelector('[data-mobile-properties-sheet="true"]')
    ).toBeNull();

    selectField(container, "studentName");
    expect(
      document.body.querySelector(
        '[data-mobile-properties-sheet="true"] [data-field-inspector="studentName"]'
      )
    ).not.toBeNull();
    expect(
      container.querySelector<HTMLInputElement>('input[name="spec"]')?.value
    ).toBe(specBefore);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Reflect.deleteProperty(globalThis, "DataTransfer");
    vi.clearAllMocks();
  });

  it("shows reconciliation only when pending completions exist and confirms PDF plus email", async () => {
    act(() => {
      root.render(
        <CertificateTemplateEditor
          certificateEnabled
          courseId="course-1"
          issuerConfigured
          pendingCertificateReconciliationCount={3}
          templates={[draftTemplate]}
        />
      );
    });

    const trigger = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Emitir certificados pendentes")
    );
    expect(trigger).toBeDefined();
    act(() => trigger?.click());
    expect(document.body.textContent).toContain(
      "geracao do PDF e o envio do e-mail"
    );

    const confirm = [...document.body.querySelectorAll("button")].find(
      (button) => button.textContent === "Emitir 3 certificados"
    );
    await act(async () => confirm?.click());

    expect(actionMocks.reconcile).toHaveBeenCalledOnce();
    const submitted = actionMocks.reconcile.mock.calls[0]?.[0] as FormData;
    expect(submitted.get("confirmed")).toBe("yes");
    expect(submitted.get("courseId")).toBe("course-1");
    expect(toastMocks.success).toHaveBeenCalledWith(
      "3 certificados enviados para geracao. Restam 0."
    );
    expect(navigationMocks.refresh).toHaveBeenCalledOnce();

    act(() => {
      root.render(
        <CertificateTemplateEditor
          certificateEnabled
          courseId="course-1"
          issuerConfigured
          pendingCertificateReconciliationCount={0}
          templates={[draftTemplate]}
        />
      );
    });
    expect(container.textContent).not.toContain(
      "Emitir certificados pendentes"
    );
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
    expect(container.textContent).toContain("Dados curtos");
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
    selectBackground(container);
    const input = container.querySelector<HTMLInputElement>(
      'input[data-upload-kind="background"]'
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

  it("keeps signer and signature values in FormData while another field is selected", () => {
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

    selectField(container, "signerName");
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    const data = new FormData(form ?? undefined);
    expect(data.get("signerName")).toBe("Dra. Maria");
    expect(data.get("signerRole")).toBe("Responsavel tecnica");
    expect(data.get("signatureKey")).toBe("certificates/signature.webp");
    selectField(container, "signatureImage");
    expect(
      container.querySelector('input[data-upload-kind="signature"]')
    ).not.toBeNull();
    expect(container.textContent).toContain("Nome do signatário");
    expect(container.textContent).toContain("Assinatura visual");
    expect(
      container.querySelector('[data-field-inspector="signatureImage"]')
    ).not.toBeNull();
  });

  it("opens the signer role inspector from the signature block", () => {
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

    selectField(container, "signerName");
    const roleButton = [
      ...container.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent === "Cargo do signatário");
    expect(roleButton).not.toBeNull();

    act(() => roleButton?.click());

    expect(
      container.querySelector('[data-field-inspector="signerRole"]')
    ).not.toBeNull();
    expect(container.querySelector("#certificate-signer-role")).not.toBeNull();
  });

  it("adds the signer role field when editing a legacy template that lacks it", () => {
    const legacyTemplate = {
      ...draftTemplate,
      spec: {
        ...draftTemplate.spec,
        fields: draftTemplate.spec.fields.filter(
          (field) => field.field !== "signerRole"
        ),
      },
    };

    act(() => {
      root.render(
        <CertificateTemplateEditor
          certificateEnabled
          courseId="course-1"
          issuerConfigured
          templates={[legacyTemplate]}
        />
      );
    });

    const visibilityTrigger = container.querySelector<HTMLButtonElement>(
      '[data-visibility-trigger="true"]'
    );
    act(() => visibilityTrigger?.click());
    expect(
      document.body.querySelector('[data-field-row="signerRole"]')
    ).not.toBeNull();
    const signerButton = document.body.querySelector<HTMLButtonElement>(
      '[data-field-row="signerName"] > button'
    );
    act(() => signerButton?.click());
    const roleButton = [
      ...container.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent === "Cargo do signatário");
    expect(roleButton).not.toBeNull();

    act(() => roleButton?.click());

    expect(
      container.querySelector('[data-field-inspector="signerRole"]')
    ).not.toBeNull();
  });

  it("restores all standard fields when editing an empty saved template", () => {
    const emptySavedTemplate = {
      ...draftTemplate,
      spec: {
        ...draftTemplate.spec,
        fields: [],
      },
    };

    act(() => {
      root.render(
        <CertificateTemplateEditor
          certificateEnabled
          courseId="course-1"
          issuerConfigured
          templates={[emptySavedTemplate]}
        />
      );
    });

    selectField(container, "signerName");
    const roleButton = [
      ...container.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent === "Cargo do signatário");
    expect(roleButton).not.toBeNull();

    act(() => roleButton?.click());

    expect(
      container.querySelector('[data-field-inspector="signerRole"]')
    ).not.toBeNull();
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
    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-preview-sample-toggle="true"]'
    );
    expect(toggle?.textContent).toContain("Dados curtos");
    act(() => toggle?.click());
    expect(toggle?.textContent).toContain("Dados longos");
    expect(container.textContent).toContain(
      "Especialização em Técnicas Avançadas"
    );
  });

  it("warns about clipped content without blocking draft save and confirms publication", async () => {
    const descriptors = {
      clientHeight: Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        "clientHeight"
      ),
      clientWidth: Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        "clientWidth"
      ),
      scrollHeight: Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        "scrollHeight"
      ),
      scrollWidth: Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        "scrollWidth"
      ),
    };
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return this.dataset.certificatePage === "true" ? 1000 : 100;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return this.dataset.previewTextField === "studentName" ? 10 : 100;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        return this.dataset.previewTextField === "studentName"
          ? 100
          : this.clientHeight;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get() {
        return this.clientWidth;
      },
    });

    try {
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
      await act(async () => {
        await Promise.resolve();
      });

      expect(
        container.querySelector('[data-certificate-overflow-warning="true"]')
      ).not.toBeNull();
      expect(container.textContent).toContain("Nome no certificado");
      expect(container.textContent).toContain("manterá o recorte");

      toggleFieldVisibility(container, "signerRole");
      const save = [...container.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Salvar rascunho")
      );
      expect(save?.disabled).toBe(false);

      const publish = [...container.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Salvar e publicar")
      );
      act(() => publish?.click());
      expect(actionMocks.publish).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain(
        "Publicar com conteúdo cortado?"
      );

      const confirm = [...document.body.querySelectorAll("button")].find(
        (button) => button.textContent === "Publicar mesmo assim"
      );
      await act(async () => confirm?.click());
      expect(actionMocks.publish).toHaveBeenCalledOnce();
    } finally {
      for (const [name, descriptor] of Object.entries(descriptors)) {
        if (descriptor) {
          Object.defineProperty(HTMLElement.prototype, name, descriptor);
        } else {
          Reflect.deleteProperty(HTMLElement.prototype, name);
        }
      }
    }
  });

  it("selects a field directly on the preview and opens its inspector", () => {
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

    const hitArea = container.querySelector<HTMLButtonElement>(
      '[data-editor-field="studentName"]'
    );
    expect(hitArea).not.toBeNull();
    act(() => hitArea?.click());

    expect(
      container.querySelector('[data-field-inspector="studentName"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-field-inspector="studentName"]')
        ?.textContent
    ).not.toContain("Visível");
    expect(hitArea?.getAttribute("aria-pressed")).toBe("true");
    expect(
      hitArea
        ?.querySelector("[data-selected-label-placement]")
        ?.getAttribute("data-selected-label-placement")
    ).toBe("above");
  });

  it("centers only the requested axis from the global toolbar", () => {
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
    selectField(container, "studentName");
    const horizontal = container.querySelector<HTMLButtonElement>(
      '[data-preview-toolbar] button[aria-label="Centralizar horizontalmente no A4"]'
    );
    const vertical = container.querySelector<HTMLButtonElement>(
      '[data-preview-toolbar] button[aria-label="Centralizar verticalmente no A4"]'
    );
    expect(horizontal).not.toBeNull();
    expect(vertical).not.toBeNull();

    act(() => horizontal?.click());
    let fields = JSON.parse(
      container.querySelector<HTMLInputElement>('input[name="spec"]')?.value ??
        "{}"
    ).fields as Array<{ field: string; x: number; y: number }>;
    let selected = fields.find((field) => field.field === "studentName");
    expect(selected).toMatchObject({ x: 15, y: 8 });

    act(() => vertical?.click());
    fields = JSON.parse(
      container.querySelector<HTMLInputElement>('input[name="spec"]')?.value ??
        "{}"
    ).fields as Array<{ field: string; x: number; y: number }>;
    selected = fields.find((field) => field.field === "studentName");
    expect(selected).toMatchObject({ x: 15, y: 47.5 });
  });

  it("fits a selected text field to its measured content", () => {
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
    selectField(container, "studentName");

    const page = container.querySelector<HTMLElement>(
      '[data-certificate-page="true"]'
    );
    const textField = container.querySelector<HTMLElement>(
      '[data-preview-text-field="studentName"]'
    );
    expect(page).not.toBeNull();
    expect(textField).not.toBeNull();
    Object.defineProperty(page, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ height: 500, width: 1000 }),
    });
    Object.defineProperty(textField, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ height: 40, width: 300 }),
    });

    const fitButton = container.querySelector<HTMLButtonElement>(
      '[data-preview-toolbar] button[aria-label="Ajustar tamanho ao conteúdo"]'
    );
    expect(fitButton).not.toBeNull();

    act(() => fitButton?.click());

    const specInput =
      container.querySelector<HTMLInputElement>('input[name="spec"]');
    const fittedField = JSON.parse(specInput?.value ?? "{}").fields.find(
      (field: { field: string }) => field.field === "studentName"
    );
    expect(fittedField).toMatchObject({
      height: 8,
      width: 30,
      x: 35,
      y: 6.5,
    });
  });

  it("uses shadcn tooltips instead of native title attributes in the toolbar", () => {
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

    const toolbarButtons = [
      ...container.querySelectorAll<HTMLButtonElement>(
        "[data-preview-toolbar] button"
      ),
    ];
    expect(toolbarButtons.length).toBeGreaterThanOrEqual(5);
    expect(
      toolbarButtons.every((button) => !button.hasAttribute("title"))
    ).toBe(true);
    expect(
      container.querySelectorAll('[data-slot="tooltip-trigger"]').length
    ).toBeGreaterThanOrEqual(4);
  });

  it("exposes semantic editor headings and visible focus styles for inspector actions", () => {
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

    expect(container.querySelector("h2")?.textContent).toContain("Certificado");
    expect(
      [...container.querySelectorAll("h3")].map(
        (heading) => heading.textContent
      )
    ).toEqual(expect.arrayContaining(["Preview", "Propriedades"]));

    selectField(container, "studentName");
    const centerButton = container.querySelector<HTMLButtonElement>(
      '[data-preview-toolbar] button[aria-label="Centralizar horizontalmente no A4"]'
    );
    expect(centerButton?.className).toContain("focus-visible:ring-3");
    expect(
      container.querySelector(
        '[data-preview-toolbar] [data-visibility-trigger="true"]'
      )
    ).not.toBeNull();

    selectField(container, "signerName");
    const roleButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Cargo do signatário"
    );
    expect(roleButton?.className).toContain("focus-visible:ring-3");
  });

  it("keeps the field inventory out of the main inspector until requested", () => {
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

    expect(container.querySelector("[data-field-row]")).toBeNull();
    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-visibility-trigger="true"]'
    );
    expect(trigger).not.toBeNull();
    act(() => trigger?.click());
    expect(
      document.body.querySelector('[data-field-row="studentName"]')
    ).not.toBeNull();
  });

  it("keeps required fields visible from the field inventory", () => {
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

    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-visibility-trigger="true"]'
    );
    act(() => trigger?.click());
    const row = document.body.querySelector('[data-field-row="studentName"]');
    const requiredSwitch =
      row?.querySelector<HTMLButtonElement>('[role="switch"]');
    expect(row?.textContent).toContain("Obrigatório");
    expect(requiredSwitch?.hasAttribute("disabled")).toBe(true);
  });

  it("moves a selected field in the preview and records one undo operation", () => {
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

    const page = container.querySelector<HTMLElement>(
      '[data-certificate-page="true"]'
    );
    const hitArea = container.querySelector<HTMLElement>(
      '[data-editor-field="studentName"]'
    );
    expect(page).not.toBeNull();
    expect(hitArea).not.toBeNull();
    Object.defineProperty(page, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ height: 500, width: 1000 }),
    });

    dispatchPointer(hitArea as Element, "pointerdown", {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    });
    expect(document.activeElement).toBe(hitArea);
    dispatchPointer(hitArea as Element, "pointermove", {
      clientX: 200,
      clientY: 150,
      pointerId: 1,
    });
    dispatchPointer(hitArea as Element, "pointerup", {
      clientX: 200,
      clientY: 150,
      pointerId: 1,
    });

    const specInput =
      container.querySelector<HTMLInputElement>('input[name="spec"]');
    const movedSpec = JSON.parse(specInput?.value ?? "{}");
    const movedField = movedSpec.fields.find(
      (field: { field: string }) => field.field === "studentName"
    );
    expect(movedField).toMatchObject({ x: 25, y: 18 });

    const undo = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Desfazer")
    );
    expect(undo?.disabled).toBe(false);
    act(() => undo?.click());
    const restoredSpec = JSON.parse(specInput?.value ?? "{}");
    const restoredField = restoredSpec.fields.find(
      (field: { field: string }) => field.field === "studentName"
    );
    expect(restoredField).toMatchObject({ x: 15, y: 8 });
  });

  it("resizes a selected field from the preview without a zoom control", () => {
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

    selectField(container, "studentName");
    const page = container.querySelector<HTMLElement>(
      '[data-certificate-page="true"]'
    );
    const hitArea = container.querySelector<HTMLElement>(
      '[data-editor-field="studentName"]'
    );
    expect(page).not.toBeNull();
    expect(hitArea).not.toBeNull();
    Object.defineProperty(page, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ height: 500, width: 1000 }),
    });
    Object.defineProperty(hitArea, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 300,
        height: 200,
        left: 100,
        right: 800,
        top: 100,
        width: 700,
      }),
    });

    dispatchPointer(hitArea as Element, "pointerdown", {
      clientX: 796,
      clientY: 296,
      pointerId: 3,
    });
    dispatchPointer(hitArea as Element, "pointermove", {
      clientX: 896,
      clientY: 346,
      pointerId: 3,
    });
    dispatchPointer(hitArea as Element, "pointerup", {
      clientX: 896,
      clientY: 346,
      pointerId: 3,
    });

    const specInput =
      container.querySelector<HTMLInputElement>('input[name="spec"]');
    const resizedSpec = JSON.parse(specInput?.value ?? "{}");
    const resizedField = resizedSpec.fields.find(
      (field: { field: string }) => field.field === "studentName"
    );
    expect(resizedField).toMatchObject({ height: 15, width: 80 });

    expect(container.querySelector("[data-preview-zoom]")).toBeNull();
  });

  it("preserves the field aspect ratio while resizing with Shift", () => {
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

    selectField(container, "studentName");
    const page = container.querySelector<HTMLElement>(
      '[data-certificate-page="true"]'
    );
    const hitArea = container.querySelector<HTMLElement>(
      '[data-editor-field="studentName"]'
    );
    Object.defineProperty(page, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ height: 500, width: 1000 }),
    });
    Object.defineProperty(hitArea, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 300,
        height: 200,
        left: 100,
        right: 800,
        top: 100,
        width: 700,
      }),
    });

    dispatchPointer(hitArea as Element, "pointerdown", {
      clientX: 796,
      clientY: 296,
      pointerId: 4,
      shiftKey: true,
    });
    dispatchPointer(hitArea as Element, "pointermove", {
      clientX: 896,
      clientY: 296,
      pointerId: 4,
      shiftKey: true,
    });
    dispatchPointer(hitArea as Element, "pointerup", {
      clientX: 896,
      clientY: 296,
      pointerId: 4,
      shiftKey: true,
    });

    const specInput =
      container.querySelector<HTMLInputElement>('input[name="spec"]');
    const resizedField = JSON.parse(specInput?.value ?? "{}").fields.find(
      (field: { field: string }) => field.field === "studentName"
    );
    expect(resizedField.width / resizedField.height).toBeCloseTo(14, 1);
  });

  it("cancels a preview movement with Escape", () => {
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

    const page = container.querySelector<HTMLElement>(
      '[data-certificate-page="true"]'
    );
    const hitArea = container.querySelector<HTMLElement>(
      '[data-editor-field="studentName"]'
    );
    Object.defineProperty(page, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ height: 500, width: 1000 }),
    });
    dispatchPointer(hitArea as Element, "pointerdown", {
      clientX: 100,
      clientY: 100,
      pointerId: 2,
    });
    dispatchPointer(hitArea as Element, "pointermove", {
      clientX: 250,
      clientY: 200,
      pointerId: 2,
    });
    act(() =>
      hitArea?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
      )
    );

    const specInput =
      container.querySelector<HTMLInputElement>('input[name="spec"]');
    const restoredSpec = JSON.parse(specInput?.value ?? "{}");
    const restoredField = restoredSpec.fields.find(
      (field: { field: string }) => field.field === "studentName"
    );
    expect(restoredField).toMatchObject({ x: 15, y: 8 });
  });

  it("nudges a selected field with the keyboard and supports undo", () => {
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

    const hitArea = container.querySelector<HTMLButtonElement>(
      '[data-editor-field="studentName"]'
    );
    selectField(container, "studentName");
    act(() => {
      hitArea?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" })
      );
    });

    const specInput =
      container.querySelector<HTMLInputElement>('input[name="spec"]');
    const nudgedSpec = JSON.parse(specInput?.value ?? "{}");
    const nudgedField = nudgedSpec.fields.find(
      (field: { field: string }) => field.field === "studentName"
    );
    expect(nudgedField).toMatchObject({ x: 15.5 });

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "z",
        })
      );
    });
    const restoredSpec = JSON.parse(specInput?.value ?? "{}");
    const restoredField = restoredSpec.fields.find(
      (field: { field: string }) => field.field === "studentName"
    );
    expect(restoredField).toMatchObject({ x: 15 });
  });

  it("shows only applicable properties for an image field", () => {
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

    selectField(container, "qrCode");
    expect(
      container.querySelector('[data-field-inspector="qrCode"]')
    ).not.toBeNull();
    expect(container.querySelector("#qrCode-x")).not.toBeNull();
    expect(container.querySelector("#qrCode-font-size")).toBeNull();
    expect(container.querySelector("#qrCode-color")).toBeNull();
  });

  it("updates a field position from the numeric inspector", () => {
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

    selectField(container, "studentName");
    const xInput = container.querySelector<HTMLInputElement>("#studentName-x");
    expect(xInput).not.toBeNull();
    act(() => {
      xInput?.focus();
      setDraftInputValue(xInput as HTMLInputElement, "22.5");
      xInput?.blur();
    });

    const specInput =
      container.querySelector<HTMLInputElement>('input[name="spec"]');
    const updatedSpec = JSON.parse(specInput?.value ?? "{}");
    const updatedField = updatedSpec.fields.find(
      (field: { field: string }) => field.field === "studentName"
    );
    expect(updatedField).toMatchObject({ x: 23 });
  });

  it("uses compact alignment toggles and keeps centered width edits balanced", () => {
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
    selectField(container, "studentName");

    const centerToggle = container.querySelector<HTMLButtonElement>(
      '[data-field-inspector="studentName"] [data-alignment-option="center"]'
    );
    expect(centerToggle?.getAttribute("aria-pressed")).toBe("true");
    expect(
      container.querySelector(
        '[data-field-inspector="studentName"] #studentName-align'
      )
    ).toBeNull();
    expect(
      container.querySelector('[data-color-picker="true"]')
    ).not.toBeNull();

    const widthInput =
      container.querySelector<HTMLInputElement>("#studentName-width");
    act(() => {
      widthInput?.focus();
      setDraftInputValue(widthInput as HTMLInputElement, "80");
      widthInput?.blur();
    });

    const specInput =
      container.querySelector<HTMLInputElement>('input[name="spec"]');
    const updatedField = JSON.parse(specInput?.value ?? "{}").fields.find(
      (field: { field: string }) => field.field === "studentName"
    );
    expect(updatedField).toMatchObject({ width: 80, x: 10 });
  });

  it("renders a slider beside each geometry input and exposes vertical alignment", async () => {
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
    await act(async () => {
      await Promise.resolve();
    });
    selectField(container, "studentName");

    expect(
      container.querySelector('[data-geometry-slider="studentName-x"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-geometry-control="studentName-x"]')
        ?.textContent
    ).toContain("Horizontal");
    expect(container.textContent).not.toContain("Unidade: % da página A4");
    expect(
      container.querySelector('[data-geometry-group="position"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-geometry-group="size"]')
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-field-inspector="studentName"] [data-alignment-row]'
      )
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-field-inspector="studentName"] [data-alignment-option="middle"]'
      )
    ).not.toBeNull();
  });

  it("opens the color picker directly on the hexadecimal input without presets", () => {
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
    selectField(container, "studentName");
    const colorInput = container.querySelector<HTMLInputElement>(
      '[data-color-picker] input[type="color"]'
    );
    expect(colorInput).not.toBeNull();
    expect(container.querySelector("#studentName-color")).not.toBeNull();
    expect(
      document.body.querySelector('[data-slot="popover-content"]')
    ).toBeNull();
    expect(document.body.querySelector("[data-color-preset]")).toBeNull();
  });

  it("keeps workload configuration in the course settings", () => {
    act(() => {
      root.render(
        <CertificateTemplateEditor
          certificateEnabled
          courseId="course-1"
          courseWorkloadHours={24}
          issuerConfigured
          templates={[draftTemplate]}
        />
      );
    });
    selectField(container, "workloadHours");

    expect(container.textContent).toContain("Carga horária");
    expect(container.textContent).toContain("24 horas");
    expect(container.querySelector("#certificate-workload-hours")).toBeNull();
    expect(container.querySelector("[data-workload-mode]")).toBeNull();
    expect(
      new FormData(container.querySelector("form") ?? undefined).get(
        "certificateWorkloadHours"
      )
    ).toBeNull();
  });

  it("keeps an empty numeric draft editable until it is committed", () => {
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

    selectField(container, "studentName");
    const xInput = container.querySelector<HTMLInputElement>("#studentName-x");
    const specInput =
      container.querySelector<HTMLInputElement>('input[name="spec"]');
    expect(xInput).not.toBeNull();

    act(() => setDraftInputValue(xInput as HTMLInputElement, ""));
    expect(xInput?.value).toBe("");
    expect(
      JSON.parse(specInput?.value ?? "{}").fields.find(
        (field: { field: string }) => field.field === "studentName"
      )?.x
    ).toBe(15);

    act(() => {
      xInput?.focus();
      xInput?.blur();
    });
    expect(xInput?.value).toBe("0");
  });

  it("uses a compact replacement card when a background already exists", () => {
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

    expect(
      container.querySelector('[data-document-properties="true"]')
    ).toBeNull();
    expect(container.querySelector("#certificate-background")).not.toBeNull();
    selectBackground(container);
    expect(
      container.querySelector('[data-compact-upload="background"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-document-properties="true"] h4')
        ?.textContent
    ).toBe("Arte de fundo");
    expect(container.textContent).toContain("Substituir imagem");
    expect(container.textContent).toContain("background.webp");
  });

  it("announces intentional overlaps without disabling save or publish", () => {
    const overlappingTemplate = {
      ...draftTemplate,
      spec: {
        ...draftTemplate.spec,
        fields: draftTemplate.spec.fields.map((field) => {
          if (field.field === "studentName") {
            return { ...field, height: 12, width: 40, x: 0, y: 0 };
          }
          if (field.field === "courseTitle") {
            return { ...field, height: 12, width: 40, x: 20, y: 0 };
          }
          return field;
        }),
      },
    };

    act(() => {
      root.render(
        <CertificateTemplateEditor
          certificateEnabled
          courseId="course-1"
          issuerConfigured
          templates={[overlappingTemplate]}
        />
      );
    });

    expect(container.textContent?.toLocaleLowerCase()).toMatch(
      overlapMessagePattern
    );
    expect(container.textContent?.toLocaleLowerCase()).toContain(
      "nome no certificado"
    );
    expect(
      container.querySelector('[data-properties-diagnostics] [role="status"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-certificate-page] [role="status"]')
    ).toBeNull();
    expect(
      container.querySelector("[data-properties-diagnostics] details")
    ).toBeNull();
    expect(container.textContent).not.toContain("Ver detalhes");
    expect(container.querySelectorAll('[data-overlap="true"]')).toHaveLength(2);

    toggleFieldVisibility(container, "signerRole");
    const save = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Salvar rascunho")
    );
    const publish = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Salvar e publicar")
    );
    expect(save?.disabled).toBe(false);
    expect(publish?.disabled).toBe(false);
    expect(publish?.getAttribute("name")).toBeNull();
    expect(publish?.getAttribute("value")).toBeNull();
  });

  it("warns before closing while the template has unsaved changes", () => {
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

    toggleFieldVisibility(container, "signerRole");

    const event = new Event("beforeunload", {
      cancelable: true,
    }) as BeforeUnloadEvent;
    act(() => window.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(true);
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
    toggleFieldVisibility(container, "signerRole");
    const save = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Salvar rascunho")
    );
    act(() => save?.click());
    expect(container.textContent).toContain("Salvando…");

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
    const submittedBackgrounds: Array<string | null> = [];
    actionMocks.save.mockImplementation((_state, data: FormData) => {
      submittedBackgrounds.push(data.get("backgroundUpload") as string | null);
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
    selectBackground(container);
    const backgroundInput = container.querySelector<HTMLInputElement>(
      'input[data-upload-kind="background"]'
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
    await act(async () => {
      confirm?.click();
      await Promise.resolve();
    });

    const save = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Salvar rascunho")
    );
    await act(async () => save?.click());
    toggleFieldVisibility(container, "signerRole");
    await act(async () => save?.click());

    expect(
      JSON.parse(submittedBackgrounds[0] ?? "{}").sizeBytes
    ).toBeGreaterThan(0);
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
    selectField(container, "signerName");
    selectBackground(container);
    const backgroundInput = container.querySelector<HTMLInputElement>(
      'input[data-upload-kind="background"]'
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
    await act(async () => {
      confirm?.click();
      await Promise.resolve();
    });

    selectField(container, "signatureImage");
    const signatureInput = container.querySelector<HTMLInputElement>(
      'input[data-upload-kind="signature"]'
    );
    const signature = new File(["signature"], "nova-assinatura.png", {
      type: "image/png",
    });
    Object.defineProperty(signatureInput, "files", {
      configurable: true,
      value: [signature],
    });
    await act(async () => {
      signatureInput?.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });
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
    expect(
      JSON.parse(String(submissions[0]?.get("backgroundUpload"))).fileName
    ).toBe("arte-certificado.webp");
    expect(
      JSON.parse(String(submissions[0]?.get("signatureUpload"))).fileName
    ).toBe("nova-assinatura.png");
    expect(submissions[0]?.get("signerName")).toBe("Dra. Atualizada");

    await act(async () => publish?.click());
    expect(submissions[1]?.has("backgroundUpload")).toBe(false);
    expect(submissions[1]?.has("signatureUpload")).toBe(false);
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
    const switches = [...document.body.querySelectorAll('[role="switch"]')];
    if (switches.length === 0) {
      const trigger = container.querySelector<HTMLButtonElement>(
        '[data-visibility-trigger="true"]'
      );
      act(() => trigger?.click());
    }
    const visibleSwitches = [
      ...document.body.querySelectorAll('[role="switch"]'),
    ];
    expect(visibleSwitches.length).toBeGreaterThan(0);
    expect(
      visibleSwitches.every((control) =>
        Boolean(control.getAttribute("aria-label"))
      )
    ).toBe(true);
    selectField(container, "studentName");
    const geometryInputs = [
      ...container.querySelectorAll('input[type="number"]'),
    ];
    expect(geometryInputs.length).toBeGreaterThan(0);
    expect(
      geometryInputs.every((control) => {
        const id = control.getAttribute("id");
        return Boolean(id && container.querySelector(`label[for="${id}"]`));
      })
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
    selectField(container, "signerName");
    selectBackground(container);
    const backgroundInput = container.querySelector<HTMLInputElement>(
      'input[data-upload-kind="background"]'
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
    await act(async () => {
      confirm?.click();
      await Promise.resolve();
    });
    selectField(container, "signatureImage");
    const signatureInput = container.querySelector<HTMLInputElement>(
      'input[data-upload-kind="signature"]'
    );
    Object.defineProperty(signatureInput, "files", {
      configurable: true,
      value: [
        new File(["signature"], "assinatura-atual.png", {
          type: "image/png",
        }),
      ],
    });
    await act(async () => {
      signatureInput?.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });
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
    expect(container.textContent).toContain("assinatura-atual.png");
    selectBackground(container);
    expect(container.textContent).toContain("arte-certificado.webp");
  });

  it("keeps the current image when a replacement upload fails", async () => {
    stagedUploadMock
      .mockRejectedValueOnce(new Error("Falha no upload da arte."))
      .mockRejectedValueOnce(new Error("Falha no upload da assinatura."));
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

    selectBackground(container);
    const backgroundInput = container.querySelector<HTMLInputElement>(
      'input[data-upload-kind="background"]'
    );
    Object.defineProperty(backgroundInput, "files", {
      configurable: true,
      value: [new File(["source"], "nova-arte.png", { type: "image/png" })],
    });
    act(() =>
      backgroundInput?.dispatchEvent(new Event("change", { bubbles: true }))
    );
    const confirm = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Confirmar recorte"
    );
    await act(async () => {
      confirm?.click();
      await Promise.resolve();
    });
    expect(
      container.querySelector('[data-compact-upload="background"]')
    ).not.toBeNull();

    selectField(container, "signatureImage");
    const signatureInput = container.querySelector<HTMLInputElement>(
      'input[data-upload-kind="signature"]'
    );
    Object.defineProperty(signatureInput, "files", {
      configurable: true,
      value: [
        new File(["signature"], "nova-assinatura.png", {
          type: "image/png",
        }),
      ],
    });
    await act(async () => {
      signatureInput?.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });
    expect(
      container.querySelector('[data-compact-upload="signature"]')
    ).not.toBeNull();
    const form = container.querySelector("form");
    const data = new FormData(form ?? undefined);
    expect(data.get("signatureKey")).toBe("certificates/signature.webp");
    expect(JSON.parse(String(data.get("spec"))).backgroundKey).toBe(
      "certificates/background.webp"
    );
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
    selectField(container, "signerName");
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
