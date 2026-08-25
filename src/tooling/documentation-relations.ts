const DECISION_REFERENCE = /\bDEC-DISC-\d{3}\b/g;
const DECISION_DEFINITION = /^##\s+(DEC-DISC-\d{3})\b/gm;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const LINE_BREAK = /\r?\n/;
const NON_CANONICAL_HEADING = "## Material não canônico";
const DOCS_DIRECTORY_PREFIX = /^docs\//u;

interface FindMissingDecisionReferencesInput {
  decisionRegister: string;
  guides: ReadonlyMap<string, string>;
}

interface ValidateSupersededPlanIndexingInput {
  indexContent: string;
  planContent: string;
  planPath: string;
}

const parseMetadata = (content: string): Map<string, string> => {
  const metadata = new Map<string, string>();
  const block = content.match(FRONTMATTER)?.[1];
  if (!block) {
    return metadata;
  }

  for (const line of block.split(LINE_BREAK)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }
    metadata.set(
      line.slice(0, separatorIndex).trim(),
      line.slice(separatorIndex + 1).trim()
    );
  }
  return metadata;
};

export const findMissingDecisionReferences = ({
  decisionRegister,
  guides,
}: FindMissingDecisionReferencesInput): string[] => {
  const definitions = new Set(
    [...decisionRegister.matchAll(DECISION_DEFINITION)]
      .map((match) => match[1])
      .filter((value): value is string => Boolean(value))
  );
  const errors: string[] = [];

  for (const [documentPath, content] of guides) {
    const references = new Set(content.match(DECISION_REFERENCE) ?? []);
    for (const reference of references) {
      if (!definitions.has(reference)) {
        errors.push(
          `${documentPath}: decisão referenciada não existe: ${reference}`
        );
      }
    }
  }

  return errors;
};

export const validateSupersededPlanIndexing = ({
  indexContent,
  planContent,
  planPath,
}: ValidateSupersededPlanIndexingInput): string[] => {
  const metadata = parseMetadata(planContent);
  if (metadata.get("execution_status") !== "superseded") {
    return [];
  }

  const errors: string[] = [];
  if (!metadata.get("superseded_by")) {
    errors.push(`${planPath}: superseded_by ausente`);
  }

  const metadataEnd = planContent.match(FRONTMATTER)?.[0].length ?? 0;
  const executorInstruction = planContent.indexOf(
    "Para executores agentes:",
    metadataEnd
  );
  const stopWarning = planContent
    .toLocaleLowerCase("pt-BR")
    .indexOf("não executar", metadataEnd);
  if (
    stopWarning < 0 ||
    (executorInstruction >= 0 && stopWarning > executorInstruction)
  ) {
    errors.push(`${planPath}: aviso 'Não executar' ausente antes do plano`);
  }

  const historicalSection = indexContent.indexOf(NON_CANONICAL_HEADING);
  const indexTarget = planPath.replace(DOCS_DIRECTORY_PREFIX, "");
  const referenceIndex = indexContent.indexOf(indexTarget);
  if (referenceIndex < 0) {
    errors.push(
      `docs/README.md: plano superseded não está indexado: ${planPath}`
    );
  } else if (historicalSection < 0 || referenceIndex < historicalSection) {
    errors.push(
      `docs/README.md: plano superseded aparece antes de Material não canônico: ${planPath}`
    );
  }

  return errors;
};
