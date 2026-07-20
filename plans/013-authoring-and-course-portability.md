# Plan 013: Evoluir autoria e portabilidade sem importar um CMS inteiro

> **Instruções ao executor**: valide a necessidade da especialista antes de mudar o
> formato persistido. Compatibilidade de leitura é contrato permanente.
>
> **Drift check inicial**:
> `git diff --stat 06f0c06..HEAD -- src/features/courses/lesson-content.ts src/features/admin/authoring.ts src/components/lesson-kind-controls.tsx src/db/schema.ts`

## Status

- **Prioridade**: P3
- **Esforço**: L
- **Risco**: MED
- **Depende de**: `008-architecture-deepening.md`,
  `010-learning-policy-content-versions-and-cohorts.md`
- **Categoria**: product, authoring
- **Planejado em**: commit `06f0c06`, 2026-07-20

## Por que importa

O Hub oferece vídeo, texto rico e materiais, suficiente para o produto atual. As
referências mostram valor em blocos semânticos, preview, conteúdo de instrutor e
import/export. A oportunidade é facilitar autoria e backup lógico, não adotar
Payload/Sanity ou dezenas de tipos.

## Estado atual

- `src/features/courses/lesson-content.ts` valida vocabulário Tiptap delimitado;
- vídeo e resources são campos/lifecycles separados;
- preview/admin existe, mas componente central é muito grande;
- sem versão de formato explícita no `content_json`;
- sem export/import de curso;
- R2 usa dois buckets e JMVStream tem lifecycle próprio;
- LearningPlatform tem blocos semânticos, mas storage dual cria drift;
- LearnHouse tem activities versionadas;
- Frappe oferece ZIP import/export, mas SCORM é inseguro no mesmo origin.

## Escopo

**Em escopo após validação**

- inventário de tarefas de autoria;
- versão de schema de conteúdo;
- poucos blocos aprovados;
- preview fiel;
- conteúdo privado de apoio à especialista;
- export/import lógico versionado;
- manifesto de assets sem incluir segredos/URLs assinadas.

**Fora de escopo**

- Payload/Sanity;
- colaboração em tempo real;
- AI generation;
- SCORM;
- custom HTML/JS;
- marketplace de templates;
- migrar vídeo para dentro do JSON;
- quebrar conteúdo existente.

## Passos

### 1. Medir fricção real de autoria

Observar a especialista criar/editar curso e registrar:

- tarefas repetidas;
- erros;
- preview divergente;
- tipos de conteúdo ausentes;
- tempo;
- necessidade de reutilização.

**Verificar**: cada bloco proposto resolve ocorrência real, não comparação abstrata.

### 2. Versionar o formato

Adicionar parser/normalizer por versão, leitura backward-compatible e migração
explícita. Conteúdo desconhecido falha de forma segura no admin e não quebra player.

**Verificar**: fixtures de todas as versões renderizam.

### 3. Introduzir o menor conjunto de blocos

Exemplo somente se validado:

- rich text;
- callout;
- image;
- table;
- divider.

Vídeo e resource continuam domínios separados. Todo bloco define semântica,
acessibilidade, validação e fallback.

**Verificar**: authoring → preview → learner tem equivalência.

### 4. Separar conteúdo da especialista

Se necessário, modelar notas de apoio privadas que nunca entram no payload da aluna.
Não esconder no mesmo JSON público.

**Verificar**: resposta/HTML do player não contém o campo privado.

### 5. Criar export lógico

Formato inclui:

- manifest version;
- course version;
- módulos/aulas/ordem;
- content JSON;
- metadados de resources;
- referências de vídeo, sem credenciais;
- checksums.

Import roda dry-run, mostra diff e cria draft. Não sobrescreve curso publicado.

**Verificar**: export → import em banco vazio produz draft semanticamente equivalente.

### 6. Definir portabilidade de assets

Separar metadata de transferência binária. URLs assinadas nunca entram no arquivo.
JMVStream pode exigir reupload/rebinding; registrar limitação.

**Verificar**: pacote não contém secret, token ou URL temporária.

## Critérios de pronto

- [ ] necessidade de cada bloco foi observada;
- [ ] conteúdo antigo continua legível;
- [ ] formato é versionado;
- [ ] preview e player são equivalentes;
- [ ] conteúdo privado não vaza;
- [ ] import é dry-run + draft;
- [ ] export não contém credenciais;
- [ ] acessibilidade e E2E passam.

## Condições STOP

- versionamento de curso não foi decidido;
- bloco exige HTML/JS arbitrário;
- import sobrescreveria published;
- JMVStream/R2 exigiriam exportar credencial;
- a solução introduz CMS externo só para editor.

## Manutenção

Cada novo bloco é um contrato permanente: parser, renderer, authoring, a11y, export e
migration. Exigir evidência de necessidade antes de ampliar o vocabulário.

