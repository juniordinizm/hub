import type { ColumnDef } from "@tanstack/react-table";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataTable } from "./data-table";

interface Row {
  count: number;
  label: string;
}

const columns: ColumnDef<Row, unknown>[] = [
  {
    accessorKey: "label",
    header: "Nome",
    meta: { rowHeader: true },
  },
  {
    accessorKey: "count",
    header: "Quantidade",
    meta: { numeric: true },
  },
];

const rows: Row[] = Array.from({ length: 11 }, (_, index) => ({
  count: index + 1,
  label: `Registro ${index + 1}`,
}));

describe("DataTable", () => {
  it("renders an accessible caption and semantic numeric column", () => {
    const markup = renderToStaticMarkup(
      <DataTable<Row, unknown>
        caption="Registros cadastrados"
        columns={columns}
        data={rows}
        searchLabel="Buscar registros"
        showPagination={false}
      />
    );

    expect(markup).toContain("Registros cadastrados");
    expect(markup).toContain('scope="col"');
    expect(markup).toContain('scope="row"');
    expect(markup).toContain('aria-label="Buscar registros"');
    expect(markup).toContain("tabular-nums");
    expect(markup).toContain("Registro 11");
    expect(markup).not.toContain("Itens por página");
  });

  it("keeps an empty result inside the semantic table", () => {
    const markup = renderToStaticMarkup(
      <DataTable<Row, unknown>
        caption="Registros cadastrados"
        columns={columns}
        data={[]}
        emptyDescription="Ainda não há registros."
        emptyTitle="Nenhum registro"
      />
    );

    expect(markup).toContain("<table");
    expect(markup).toContain("Registros cadastrados");
    expect(markup).toContain("Nenhum registro");
    expect(markup).toContain("Ainda não há registros.");
    expect(markup).not.toContain(">Anterior<");
  });
});
