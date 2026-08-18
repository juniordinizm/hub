import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminMutationForm } from "./admin-mutation-form";

describe("AdminMutationForm", () => {
  it("does not render a DialogClose when used by a Sheet", () => {
    const markup = renderToStaticMarkup(
      <AdminMutationForm
        action={vi.fn().mockResolvedValue(undefined)}
        closeOnSuccess={false}
      >
        <button type="submit">Salvar</button>
      </AdminMutationForm>
    );

    expect(markup).toContain("Salvar");
    expect(markup).not.toContain("Fechar");
  });
});
