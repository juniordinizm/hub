import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("checkout UI contract", () => {
  it("routes authenticated purchases through the public invoice form", async () => {
    const dashboard = await readFile(
      "src/app/(student)/app/(dashboard)/page.tsx",
      "utf8"
    );
    const purchaseForm = await readFile(
      "src/app/comprar/[slug]/purchase-form-client.tsx",
      "utf8"
    );

    expect(dashboard).toContain("route(`/comprar/");
    expect(dashboard).toContain("course.slug");
    expect(dashboard).not.toContain('name="checkoutAttemptId"');
    expect(purchaseForm).toContain("crypto.randomUUID()");
    expect(purchaseForm).toContain('name="cpfCnpj"');
    expect(purchaseForm).not.toContain('name="cardNumber"');
  });

  it("does not claim payment confirmation on callback pages", async () => {
    const authenticated = await readFile(
      "src/app/(student)/app/checkout/sucesso/page.tsx",
      "utf8"
    );
    const publicPage = await readFile(
      "src/app/checkout/sucesso/page.tsx",
      "utf8"
    );

    expect(authenticated).not.toContain("Compra confirmada");
    expect(authenticated).toContain("Pagamento em verificação");
    expect(publicPage).toContain("Pagamento em confirmacao");
  });
});
