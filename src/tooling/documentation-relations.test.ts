import { describe, expect, it } from "vitest";
import {
  findMissingDecisionReferences,
  validateSupersededPlanIndexing,
} from "./documentation-relations";

describe("documentation relations", () => {
  it("rejects guide decision references absent from the register", () => {
    expect(
      findMissingDecisionReferences({
        decisionRegister: "## DEC-DISC-001\n\n**Estado:** aprovado.",
        guides: new Map([
          ["docs/domain/example.md", "Usa DEC-DISC-001 e DEC-DISC-999."],
        ]),
      })
    ).toEqual([
      "docs/domain/example.md: decisão referenciada não existe: DEC-DISC-999",
    ]);
  });

  it("allows a superseded plan only in the historical index after a stop warning", () => {
    const planPath = "docs/superpowers/plans/old.md";
    const planContent = `---
execution_status: superseded
superseded_by: docs/superpowers/plans/current.md
---

> Plano substituído. Não executar.

# Plano antigo`;

    expect(
      validateSupersededPlanIndexing({
        indexContent: `## Plano mestre em execução

## Material não canônico

- [Plano substituído](superpowers/plans/old.md)`,
        planContent,
        planPath,
      })
    ).toEqual([]);

    expect(
      validateSupersededPlanIndexing({
        indexContent: `## Plano mestre em execução

- [Plano antigo](superpowers/plans/old.md)

## Material não canônico`,
        planContent,
        planPath,
      })
    ).toContain(
      "docs/README.md: plano superseded aparece antes de Material não canônico: docs/superpowers/plans/old.md"
    );
  });
});
