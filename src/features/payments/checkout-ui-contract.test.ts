import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("checkout UI contract", () => {
  it("routes authenticated purchases through the reviewed public handoff", async () => {
    const source = await readFile(
      "src/app/(student)/app/(dashboard)/page.tsx",
      "utf8"
    );

    expect(source).toContain("/comprar/");
    expect(source).toContain("course.slug");
    expect(source).not.toContain("startCourseCheckoutAction");
    expect(source).not.toContain("randomUUID");
    expect(source).not.toContain('name="buyerEmail"');
    expect(source).not.toContain('name="buyerName"');
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
