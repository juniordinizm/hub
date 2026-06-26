import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("enrollment expiration controls", () => {
  it("uses only the shadcn date picker and a single submit button", async () => {
    const source = await readFile(
      new URL("./enrollment-expiration-controls.tsx", import.meta.url),
      "utf8"
    );
    const saveAdjustmentCount = source.match(/Salvar ajuste/g)?.length ?? 0;

    expect(source).toContain("DatePickerField");
    expect(source).toContain('name="newExpiresAt"');
    expect(source).toContain('value="set_exact"');
    expect(source).toContain("minDate");
    expect(source).toContain("Salvar ajuste");
    expect(source).toContain("Expiracao original");
    expect(source).toContain("Expiracao atual");
    expect(source).not.toContain('type="radio"');
    expect(source).not.toContain("extend_1_day");
    expect(source).not.toContain("extend_7_days");
    expect(source).not.toContain("extend_1_month");
    expect(saveAdjustmentCount).toBe(1);
  });

  it("uses plain-language controls for blocking and restoring access", async () => {
    const source = await readFile(
      new URL("./enrollment-expiration-controls.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("blockEnrollmentAccessAction");
    expect(source).toContain("restoreEnrollmentAccessAction");
    expect(source).toContain("Bloquear acesso");
    expect(source).toContain("Restaurar acesso");
    expect(source).not.toContain("grant");
    expect(source).not.toContain("projection");
  });
});
